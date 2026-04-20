const logs = document.getElementById('logs');
const canvas = document.getElementById('speedGraph');
const ctx = canvas.getContext('2d');
const { spawn } = require('child_process');

const pythonPath = '/Users/hansikaiddagoda/Documents/Real-Time Network Traffic Monitor/network monitor/scapy-env/bin/python';
const pythonProcess = spawn(pythonPath, ['script.py']);

let speeds = [];
let packetQueue = [];

let isFrozen = false;
const freezeBtn = document.getElementById('freezeBtn');

freezeBtn.addEventListener('click', () => {
    isFrozen = !isFrozen;

    if (isFrozen) {
        freezeBtn.textContent = "Unfreeze Capturing";
        freezeBtn.classList.add('active');
    } else {
        freezeBtn.textContent = "Freeze Capturing";
        freezeBtn.classList.remove('active');
    }
});

pythonProcess.stdout.on('data', (data) => {
    // REQUIREMENT: If frozen, discard incoming packets (packet loss)
    if (isFrozen) return;

    try {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            const parsed = JSON.parse(line);
            packetQueue.push(parsed);
        });
    } catch (e) {
        // Handle partial chunks
    }
});

pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
});

function processPackets() {
    if (isFrozen || packetQueue.length === 0) return;

    while (packetQueue.length > 0) {
        const currentPacket = packetQueue.shift();
        
        let colorClass = 'red';
        if (currentPacket[0] === 'TCP') colorClass = 'green';
        if (currentPacket[0] === 'QUIC') colorClass = 'lime';
        if (currentPacket[0] === 'ARP' || currentPacket[0] === 'ICMP') colorClass = 'blue';

        const row = document.createElement('div');
        row.className = `line ${colorClass}`;

        // Create the individual cells
        row.innerHTML = `
            <span>${currentPacket[0]}</span>
            <span>${currentPacket[1]}</span>
            <span>${currentPacket[2]}</span>
            <span class="col-size">${currentPacket[3]} B</span>
            <span>${currentPacket[4]} Mbps</span>
        `;

        logs.appendChild(row);

        if (logs.childNodes.length > 100) {
            logs.removeChild(logs.firstChild);
        }

        speeds.push(currentPacket[4]);
        if (speeds.length > 100) speeds.shift();
    }

    logs.scrollTop = logs.scrollHeight;
    drawGraph();
}


function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxSpeed = Math.max(...speeds, 5); // Scale to at least 5 Mbps

    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    speeds.forEach((val, i) => {
        const x = i * (canvas.width / (speeds.length - 1 || 1));
        const y = canvas.height - (val / maxSpeed) * canvas.height;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function updateUI() {
    processPackets();
    requestAnimationFrame(updateUI);
}

updateUI();