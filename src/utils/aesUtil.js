require('dotenv').config();
const crypto = require('crypto')
const fs = require('fs')

exports.encryptFile = async (user_id, aes_key, file) => {
    const algorithm = process.env.AES_ALGORITHM
    const key = Buffer.from(aes_key, 'hex') // Kunci 256-bit
    const iv = Buffer.from(process.env.AES_IV, 'hex')  // IV 16-byte

    // 1. Baca file dan konversi ke hex string
    const fileHex = file.buffer.toString('hex')

    // 2. Gabungkan metadata (nama & ekstensi) dengan hex file
    const fileInfo = `${user_id}-${file.originalname}::${fileHex}`

    // 3. Enkripsi string hasil gabungan
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encryptedHex = cipher.update(fileInfo, 'utf8', 'hex')
    encryptedHex += cipher.final('hex')

    const pathFile = `./public/files/uploads/${user_id}-data.txt`
    fs.writeFileSync(pathFile, encryptedHex)
}
