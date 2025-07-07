require('dotenv').config();

const app = require('./src/app');
const os = require('os');

BigInt.prototype.toJSON = function() { return this.toString() }

const port = process.env.APP_PORT || 5050;
const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('wifi')) { // Memeriksa apakah nama antarmuka mengandung 'wifi'
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    }
    return '127.0.0.1';
};

const localUrl = `http://localhost:${port}`;
const publicUrl = `http://${getLocalIp()}:${port}`;

app.listen(port, '0.0.0.0', () => {
    console.log(`App running on:`);
    console.log(`- Local: ${localUrl}`);
    console.log(`- Public: ${publicUrl}`);
});
