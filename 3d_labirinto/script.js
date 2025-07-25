// Check if PointerLockControls is available immediately after scripts are loaded
if (typeof THREE === 'undefined' || typeof THREE.PointerLockControls === 'undefined') {
    console.error("Erro: Three.js ou PointerLockControls não carregados. O jogo não pode iniciar.");
    document.body.innerHTML = "<p style='color:red; text-align:center; margin-top:50px;'>Erro ao carregar o jogo. Por favor, verifique sua conexão ou tente novamente.</p>";
    // Stop further script execution if dependencies are missing
    throw new Error("Missing Three.js or PointerLockControls.");
}
console.log("PointerLockControls disponível:", !!THREE.PointerLockControls);

const maze = [
    // Labirinto 15x15
    "1111111111111111111111111111111111111111111111111111111111111111",
"1000001000001000001000001000001000001000001000001000001000000001",
"1011101011101011101011101011101011101011101011101011101011111101",
"1010001010001010001010001010001010001010001010001010001010000101",
"1010111010111010111010111010111010111010111010111010111010111101",
"1000100000100000100000100000100000100000100000100000100000100001",
"1110101110101110101110101110101110101110101110101110101110101111",
"1000100000100000100000100000100000100000100000100000100000100001",
"1011101110111011101110111011101110111011101110111011101110111101",
"1000001000001000001000001000001000001000001000001000001000000001",
"1010111010111010111010111010111010111010111010111010111010111101",
"1010000010000010000010000010000010000010000010000010000010000101",
"1011101011101011101011101011101011101011101011101011101011111101",
"1000000000000000000000000000000000000000000000000000000000000001",
"1111111111111111111111111111111111111111111111111111111111111111"
].map(row => row.split('').map(Number));

const cellSize = 10;
const player = { x: 1.0, z: 1.0 }; 
const exit = { x: 13.5, z: 13.5 };   

let scene, camera, renderer, controls, clock, startTime, victory = false;
const timerElem = document.getElementById("timer");

const keys = {};
document.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "r") location.reload();
});
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// --- Variáveis para Head Bobbing e Corrida ---
const walkSpeed = 15; 
const runSpeed = 25; 
const headBobbingAmount = 0.2; 
const headBobbingSpeed = 8; 
let totalTime = 0; 
// --- Fim das Variáveis ---

// --- Objetos colecionáveis (chaves) ---
let keysToCollect = [];
let collectedKeys = 0;
const totalKeys = 10; // Agora são 10 chaves
let keyMeshes = [];
// --- Fim das Variáveis de Chave ---

function init() {
    try {
        console.log("Iniciando cena Three.js...");

        scene = new THREE.Scene();
        // Céu preto sólido
        scene.background = new THREE.Color(0x000000);
        scene.fog = new THREE.Fog(0x222222, 0, 25); // Nevoeiro cinza escuro

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        console.log("Renderizador e câmera configurados.");

        controls = new THREE.PointerLockControls(camera, document.body);
        scene.add(controls.getObject());
        // Set initial camera position based on player start
        camera.position.set(player.x * cellSize, cellSize / 2, player.z * cellSize);
        document.body.addEventListener('click', () => {
            if (!controls.isLocked) { // Only lock if not already locked
                controls.lock();
            }
        });
        console.log("Controles criados e câmera posicionada.");

        // Add AxesHelper for visual debugging (X: red, Y: green, Z: blue)
        const axesHelper = new THREE.AxesHelper(50);
        scene.add(axesHelper);
        console.log("AxesHelper adicionado.");

        const ambient = new THREE.AmbientLight(0xcccccc);
        const light = new THREE.DirectionalLight(0xffffff, 0.7);
        light.position.set(1, 2, 1);
        scene.add(ambient, light);
        console.log("Luzes adicionadas.");

        // --- CHÃO COM TEXTURA ---
        new THREE.TextureLoader().load('img/chao.jpg', function(floorTexture) {
            floorTexture.wrapS = THREE.RepeatWrapping;
            floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.repeat.set((maze[0].length + 6) / 2, (maze.length + 6) / 2);
            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry((maze[0].length + 6) * cellSize, (maze.length + 6) * cellSize),
                new THREE.MeshLambertMaterial({ map: floorTexture })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.01;
            floor.position.x = (maze[0].length * cellSize) / 2 - cellSize * 1.5;
            floor.position.z = (maze.length * cellSize) / 2 - cellSize * 1.5;
            scene.add(floor);
            console.log("Chão com textura criado.");
        }, undefined, function(err) {
            // Fallback: chão preto
            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry((maze[0].length + 6) * cellSize, (maze.length + 6) * cellSize),
                new THREE.MeshLambertMaterial({ color: 0x000000 })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.01;
            floor.position.x = (maze[0].length * cellSize) / 2 - cellSize * 1.5;
            floor.position.z = (maze.length * cellSize) / 2 - cellSize * 1.5;
            scene.add(floor);
            console.log("Chão preto fallback criado.");
        });
        // --- FIM DO CHÃO COM TEXTURA ---  

        const wallGroup = new THREE.Group();
        let wallMat;
        let wallTexture = null;
        let wallCount = 0;
        // Carregar textura da parede de 'img/parede.jpg'
        const wallTextureLoader = new THREE.TextureLoader();
        wallTextureLoader.load('img/parede.jpg', function(wallTexture) {
            wallTexture.wrapS = THREE.RepeatWrapping;
            wallTexture.wrapT = THREE.RepeatWrapping;
            wallTexture.repeat.set(1, 1);
            wallMat = new THREE.MeshLambertMaterial({ map: wallTexture });
            for (let z = 0; z < maze.length; z++) {
                for (let x = 0; x < maze[z].length; x++) {
                    if (maze[z][x] === 1) {
                        const wall = new THREE.Mesh(
                            new THREE.BoxGeometry(cellSize, cellSize, cellSize),
                            wallMat
                        );
                        wall.position.set(x * cellSize, cellSize / 2, z * cellSize);
                        wallGroup.add(wall);
                        wallCount++;
                    }
                }
            }
            scene.add(wallGroup);
            console.log(`Paredes adicionadas: ${wallCount}.`);
        }, function(){}, function(err){
            // Fallback: cor sólida se a textura falhar
            wallMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
            for (let z = 0; z < maze.length; z++) {
                for (let x = 0; x < maze[z].length; x++) {
                    if (maze[z][x] === 1) {
                        const wall = new THREE.Mesh(
                            new THREE.BoxGeometry(cellSize, cellSize, cellSize),
                            wallMat
                        );
                        wall.position.set(x * cellSize, cellSize / 2, z * cellSize);
                        wallGroup.add(wall);
                        wallCount++;
                    }
                }
            }
            scene.add(wallGroup);
            console.log('Paredes adicionadas com cor sólida (erro ao carregar textura).');
        });

        const goal = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0x00aaff }) // Basic material is not affected by light
        );
        goal.position.set(exit.x * cellSize, 2, exit.z * cellSize);
        scene.add(goal);
        console.log("Saída adicionada.");

        // Gerar chaves em posições aleatórias válidas (não parede, não player, não saída)
        keysToCollect = [];
        keyMeshes = [];
        collectedKeys = 0;
        let placed = 0;
        while (placed < totalKeys) {
            let x = Math.floor(Math.random() * maze[0].length);
            let z = Math.floor(Math.random() * maze.length);
            // Não pode ser parede, nem player, nem saída, nem sobrepor outra chave
            if (
                maze[z][x] === 0 &&
                !(x === 1 && z === 1) &&
                !(x === 13 && z === 13) &&
                !keysToCollect.some(k => k.x === x && k.z === z)
            ) {
                keysToCollect.push({ x, z });
                placed++;
            }
        }
        // Adicionar as chaves na cena, cada uma com cor e forma diferente
        const keyShapes = [
            // Cone vermelho escuro
            () => new THREE.Mesh(
                new THREE.ConeGeometry(2, 4, 16),
                new THREE.MeshLambertMaterial({ color: 0x660000 })
            ),
            // Prisma verde escuro (Box)
            () => new THREE.Mesh(
                new THREE.BoxGeometry(3, 3, 3),
                new THREE.MeshLambertMaterial({ color: 0x003300 })
            ),
            // Esfera azul escuro
            () => new THREE.Mesh(
                new THREE.SphereGeometry(2, 16, 16),
                new THREE.MeshLambertMaterial({ color: 0x002244 })
            ),
            // Cilindro roxo escuro
            () => new THREE.Mesh(
                new THREE.CylinderGeometry(2, 2, 4, 16),
                new THREE.MeshLambertMaterial({ color: 0x2a0033 })
            ),
            // Octaedro laranja escuro
            () => new THREE.Mesh(
                new THREE.OctahedronGeometry(2),
                new THREE.MeshLambertMaterial({ color: 0x663300 })
            ),
            // Tetraedro amarelo escuro
            () => new THREE.Mesh(
                new THREE.TetrahedronGeometry(2),
                new THREE.MeshLambertMaterial({ color: 0x666600 })
            ),
            // Dodecaedro azul petróleo
            () => new THREE.Mesh(
                new THREE.DodecahedronGeometry(2),
                new THREE.MeshLambertMaterial({ color: 0x003344 })
            ),
            // Torus rosa escuro
            () => new THREE.Mesh(
                new THREE.TorusGeometry(2, 0.7, 12, 24),
                new THREE.MeshLambertMaterial({ color: 0x440033 })
            ),
            // Cone invertido marrom escuro
            () => {
                const mesh = new THREE.Mesh(
                    new THREE.ConeGeometry(2, 4, 16),
                    new THREE.MeshLambertMaterial({ color: 0x332200 })
                );
                mesh.rotation.z = Math.PI;
                return mesh;
            },
            // Prisma azul escuro (Box alongado)
            () => new THREE.Mesh(
                new THREE.BoxGeometry(2, 5, 2),
                new THREE.MeshLambertMaterial({ color: 0x001a33 })
            )
        ];
        for (let i = 0; i < keysToCollect.length; i++) {
            const key = keysToCollect[i];
            const mesh = keyShapes[i % keyShapes.length]();
            mesh.position.set(key.x * cellSize + cellSize/2, 2, key.z * cellSize + cellSize/2);
            scene.add(mesh);
            keyMeshes.push(mesh);
        }

        clock = new THREE.Clock();
        startTime = Date.now();

        animate();
        console.log("Loop de animação iniciado.");

    } catch (e) {
        console.error("Erro fatal durante a inicialização do jogo:", e);
        document.body.innerHTML = "<p style='color:red; text-align:center; margin-top:50px;'>Ocorreu um erro crítico. Por favor, tente novamente.</p>";
    }
}

function updateMovement(delta) {
    if (!controls || !controls.isLocked) return;

    let currentMoveSpeed = walkSpeed * delta;
    let isMoving = false;

    if (keys[" "]) { // Tecla de espaço para correr
        currentMoveSpeed = runSpeed * delta;
    }
    // Detect movement
    if (keys["w"] || keys["arrowup"] || keys["s"] || keys["arrowdown"] || 
        keys["a"] || keys["arrowleft"] || keys["d"] || keys["arrowright"]) {
        isMoving = true;
    }
    // Movimento padrão (sem checagem prévia de colisão)
    if (keys["w"] || keys["arrowup"]) { controls.moveForward(currentMoveSpeed); }
    if (keys["s"] || keys["arrowdown"]) { controls.moveForward(-currentMoveSpeed); }
    if (keys["a"] || keys["arrowleft"]) { controls.moveRight(-currentMoveSpeed); }
    if (keys["d"] || keys["arrowright"]) { controls.moveRight(currentMoveSpeed); }


    // Head Bobbing
    const originalCameraY = cellSize / 2; 
    if (isMoving) {
        totalTime += delta * headBobbingSpeed;
        const bobAmount = Math.sin(totalTime) * headBobbingAmount;
        camera.position.y = originalCameraY + bobAmount;
    } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, originalCameraY, 0.1);
    }
    // Collision detection (como era antes)
    const currentPos = controls.getObject().position;
    const currentCellX = Math.floor(currentPos.x / cellSize + 0.5); // Add 0.5 for centering
    const currentCellZ = Math.floor(currentPos.z / cellSize + 0.5); // Add 0.5 for centering

    if (maze[currentCellZ]?.[currentCellX] === 1) {
        // Revert to previous position (simple collision, might ainda sentir um "tranco")
        currentPos.x = player.x * cellSize;
        currentPos.z = player.z * cellSize;
    } else if (isMoving) { 
        player.x = currentPos.x / cellSize;
        player.z = currentPos.z / cellSize;
    }
}


function animate() {
    requestAnimationFrame(animate); 
    const delta = clock.getDelta();

    if (!victory) {
        updateMovement(delta);
        // Checar coleta de chaves
        for (let i = keyMeshes.length - 1; i >= 0; i--) {
            const mesh = keyMeshes[i];
            const key = keysToCollect[i];
            // Posição do player em relação ao centro da célula
            const dx = player.x - (key.x + 0.5);
            const dz = player.z - (key.z + 0.5);
            if (Math.sqrt(dx * dx + dz * dz) < 0.7) {
                scene.remove(mesh);
                keyMeshes.splice(i, 1);
                keysToCollect.splice(i, 1);
                collectedKeys++;
                // Mensagem opcional de coleta
                let msg = document.getElementById("keyMsg");
                if (!msg) {
                    msg = document.createElement("div");
                    msg.id = "keyMsg";
                    msg.style.position = "fixed";
                    msg.style.top = "20%";
                    msg.style.left = "50%";
                    msg.style.transform = "translate(-50%, -50%)";
                    msg.style.background = "rgba(0,0,0,0.8)";
                    msg.style.color = "#ffd700";
                    msg.style.padding = "18px 28px";
                    msg.style.fontSize = "1.5em";
                    msg.style.borderRadius = "12px";
                    msg.style.zIndex = 1000;
                    document.body.appendChild(msg);
                }
                msg.innerText = `Chave coletada! (${collectedKeys}/${totalKeys})`;
                setTimeout(() => { if (msg) msg.remove(); }, 1200);
            }
        }
        checkVictory();
        const t = ((Date.now() - startTime) / 1000).toFixed(1);
        timerElem.textContent = t;
    }
    renderer.render(scene, camera);
}

function checkVictory() {
    const distanceThreshold = 0.8;
    const dx = player.x - exit.x;
    const dz = player.z - exit.z;
    // Só pode vencer se todas as chaves foram coletadas
    if (!victory && collectedKeys === totalKeys && Math.sqrt(dx * dx + dz * dz) < distanceThreshold) {
        document.getElementById("victory").style.display = "flex";
        victory = true;
        controls.unlock();
    } else if (!victory && collectedKeys < totalKeys && Math.sqrt(dx * dx + dz * dz) < distanceThreshold) {
        // Mensagem opcional: precisa de todas as chaves
        let msg = document.getElementById("needKeys");
        if (!msg) {
            msg = document.createElement("div");
            msg.id = "needKeys";
            msg.style.position = "fixed";
            msg.style.top = "30%";
            msg.style.left = "50%";
            msg.style.transform = "translate(-50%, -50%)";
            msg.style.background = "rgba(0,0,0,0.8)";
            msg.style.color = "#fff";
            msg.style.padding = "24px 32px";
            msg.style.fontSize = "2em";
            msg.style.borderRadius = "16px";
            msg.style.zIndex = 1000;
            msg.innerText = `Colete todas as chaves para sair! (${collectedKeys}/${totalKeys})`;
            document.body.appendChild(msg);
            document.body.appendChild(msg);
            setTimeout(() => { if (msg) msg.remove(); }, 2000);
        }
    }
}

function drawMinimap() {
    const minimapCanvas = document.getElementById("minimap");
    if (!minimapCanvas) {
        console.error("Minimap canvas not found!");
        return;
    }
    const ctx = minimapCanvas.getContext("2d");
    if (!ctx) {
        console.error("Could not get 2D context for minimap canvas!");
        return;
    }
    // Fundo do minimapa
    ctx.clearRect(0, 0, 120, 120);
    ctx.save();
    ctx.fillStyle = "#181818";
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(0, 0, 120, 120);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const scale = 120 / maze.length; 

    // Desenhar paredes e caminhos
    for (let z = 0; z < maze.length; z++) {
        for (let x = 0; x < maze[z].length; x++) {
            ctx.fillStyle = maze[z][x] === 1 ? "#444" : "#222";
            ctx.fillRect(x * scale, z * scale, scale, scale);
        }
    }
    // Grade
    ctx.save();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= maze.length; i++) {
        ctx.beginPath();
        ctx.moveTo(i * scale, 0);
        ctx.lineTo(i * scale, 120);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * scale);
        ctx.lineTo(120, i * scale);
        ctx.stroke();
    }
    ctx.restore();
    // Chaves com ícone
    const keyColors = ["#660000", "#003300", "#002244"];
    for (let i = 0; i < keysToCollect.length; i++) {
        const key = keysToCollect[i];
        ctx.save();
        ctx.translate((key.x + 0.5) * scale, (key.z + 0.5) * scale);
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = keyColors[i % keyColors.length];
        ctx.shadowColor = keyColors[i % keyColors.length];
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Ícone: cone, quadrado, círculo
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.2;
        if (i % 3 === 0) { // cone
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(4, 4);
            ctx.lineTo(-4, 4);
            ctx.closePath();
            ctx.stroke();
        } else if (i % 3 === 1) { // prisma
            ctx.strokeRect(-3, -3, 6, 6);
        } else { // esfera
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
    // Saída destacada
    ctx.save();
    ctx.beginPath();
    ctx.arc(exit.x * scale, exit.z * scale, 7, 0, Math.PI * 2);
    ctx.strokeStyle = collectedKeys === totalKeys ? "#00ffff" : "#444";
    ctx.lineWidth = 3;
    ctx.shadowColor = collectedKeys === totalKeys ? "#00ffff" : "#444";
    ctx.shadowBlur = collectedKeys === totalKeys ? 10 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = collectedKeys === totalKeys ? "#00ffff" : "#444";
    ctx.beginPath();
    ctx.arc(exit.x * scale, exit.z * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Player com contorno
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x * scale, player.z * scale, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(player.x * scale, player.z * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
init();