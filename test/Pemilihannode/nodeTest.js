const { performance } = require('perf_hooks')
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:4001/v1'
const TOTAL_REQUESTS = 10
const DELAY_MS = 30
const FILE_PATH = path.resolve('D:TA/Dokumen/MOM-TA-24-05-w18.pdf')

const PATIENTS = [
  {
    address: '0xE2436cb4D6ddbedC3Ae4DbB6c5581D596fFD1E4F',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHhFMjQzNmNiNEQ2ZGRiZWRDM0FlNERiQjZjNTU4MUQ1OTZmRkQxRTRGIiwiaWF0IjoxNzUwODIyNTgyfQ.0LRAkgp8kynMe11AI33JVPl3MjPuAGfKm0SQgb-hQmQ'
  },
  {
    address: '0x94111F8Cf0a14Da3226d76d88fa73719a358D692',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHg5NDExMUY4Q2YwYTE0RGEzMjI2ZDc2ZDg4ZmE3MzcxOWEzNThENjkyIiwiaWF0IjoxNzUwODIzMzcxfQ.KzQEXwgpyu4PlmEheM0TPJlUartI-ieQUQQABC5XPDw'
  },
  {
    address: '0x1FAd29D67e915d06E9Fcd4223bf28BDcBC0D0099',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxRkFkMjlENjdlOTE1ZDA2RTlGY2Q0MjIzYmYyOEJEY0JDMEQwMDk5IiwiaWF0IjoxNzUwODIzNDg0fQ.7h_DWAJJWAC5gOXim3SAhEeG1QEjO-coMfHxiVRK3kk'
  }
]

const stats = {
    create: [],
    read: [],
    update: [],
    delete: [],
    createFail: 0,
    readFail: 0,
    updateFail: 0,
    deleteFail: 0,
}

const testResults = []

const startTimes = {
    create: 0,
    read: 0,
    update: 0,
    delete: 0,
}
const endTimes = {
    create: 0,
    read: 0,
    update: 0,
    delete: 0,
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testCreate(i, patient) {
    const headers = { Authorization: patient.token }
    const form = new FormData()
    form.append('file', fs.createReadStream(FILE_PATH))
    form.append('patientAddress', patient.address)
    form.append('description', `Test #${i}`)
    form.append('recordType', 'Health Record')

    const t0 = performance.now()
    const res = await axios.post(`${BASE_URL}/health-records`, form, {
        headers: { ...form.getHeaders(), ...headers },
    })
    const t1 = performance.now()
    stats.create.push(t1 - t0)
    const recordId = res.data.data.recordId
    console.log(`[${i}] ✅ CREATE - ID: ${recordId}`)
    return recordId
}

async function testRead(i, patient, recordId) {
    const headers = { Authorization: patient.token }
    const t2 = performance.now()
    await axios.get(
        `${BASE_URL}/health-records/${patient.address}/${recordId}`,
        { headers }
    )
    const t3 = performance.now()
    stats.read.push(t3 - t2)
    console.log(`[${i}] ✅ READ`)
}

async function testUpdate(i, patient, oldRecordId) {
    const headers = {
        Authorization: patient.token,
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    const t4 = performance.now()
    const res = await axios.put(
        `${BASE_URL}/health-records/${patient.address}/${oldRecordId}/no-file`,
        new URLSearchParams({
            description: `Updated #${i}`,
            recordType: 'Radiologi',
        }),
        { headers }
    )
    const t5 = performance.now()
    stats.update.push(t5 - t4)
    const newRecordId = res?.data?.data?.recordId
    console.log(`[${i}] ✅ UPDATE - New ID: ${newRecordId}`)
    return newRecordId
}

async function testDelete(i, patient, recordId) {
    const headers = { Authorization: patient.token }
    const t6 = performance.now()
    await axios.delete(
        `${BASE_URL}/health-records/${patient.address}/${recordId}`,
        { headers }
    )
    const t7 = performance.now()
    stats.delete.push(t7 - t6)
    console.log(`[${i}] ✅ DELETE`)
}

function printStat(name, data, fail) {
    const total = data.length + fail
    const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1)
    const duration =
        (endTimes[name.toLowerCase()] - startTimes[name.toLowerCase()]) / 1000
    const throughput = total / duration

    console.log(
        `\n📊 ${name} - Total: ${total}, Success: ${
            data.length
        }, Fail: ${fail}, Avg Time: ${avg.toFixed(
            2
        )}ms, Throughput: ${throughput.toFixed(2)} RPS`
    )
    function calculateStdDev(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length
        const variance =
            data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length
        return Math.sqrt(variance)
    }
    
    const stdDev = calculateStdDev(data)
    console.log(`Std Dev Latency : ${stdDev.toFixed(2)}ms`)
    
}

// ----------------------
// RUNNER PER STAGE
// ----------------------

async function runCreate(i) {
    if (i === 1) startTimes.create = performance.now()
    const patient = PATIENTS[i % PATIENTS.length]
    try {
        const id = await testCreate(i, patient)
        testResults[i] = { patient, recordId: id }
        // eslint-disable-next-line no-unused-vars
    } catch (err) {
        stats.createFail++
        console.log(`[${i}] ❌ CREATE FAILED`)
    }
    if (i === TOTAL_REQUESTS) endTimes.create = performance.now()
    await sleep(DELAY_MS)
}

async function runRead(i) {
    if (i === 1) startTimes.read = performance.now()
    const { patient, recordId } = testResults[i] || {}
    if (!patient || !recordId) return
    try {
        await testRead(i, patient, recordId)
    } catch {
        stats.readFail++
        console.log(`[${i}] ❌ READ FAILED`)
    }
    if (i === TOTAL_REQUESTS) endTimes.read = performance.now()
    await sleep(DELAY_MS)
}

async function runUpdate(i) {
    if (i === 1) startTimes.update = performance.now()
    const { patient, recordId } = testResults[i] || {}
    if (!patient || !recordId) return
    try {
        const newId = await testUpdate(i, patient, recordId)
        testResults[i].updatedId = newId
    } catch {
        stats.updateFail++
        console.log(`[${i}] ❌ UPDATE FAILED`)
    }
    if (i === TOTAL_REQUESTS) endTimes.update = performance.now()
    await sleep(DELAY_MS)
}

async function runDelete(i) {
    if (i === 1) startTimes.delete = performance.now()
    const { patient, updatedId } = testResults[i] || {}
    if (!patient || !updatedId) return
    try {
        await testDelete(i, patient, updatedId)
    } catch {
        stats.deleteFail++
        console.log(`[${i}] ❌ DELETE FAILED`)
    }
    if (i === TOTAL_REQUESTS) endTimes.delete = performance.now()
    await sleep(DELAY_MS)
}

async function runTest() {
    console.log(
        `🚀 Starting performance test with ${TOTAL_REQUESTS} requests per operation\n`
    )

    const tasksCreate = []
    const tasksRead = []
    const tasksUpdate = []
    const tasksDelete = []

    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        const delay = DELAY_MS * (i - 1)
        tasksCreate.push(sleep(delay).then(() => runCreate(i)))
    }
    await Promise.all(tasksCreate)

    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        const delay = DELAY_MS * (i - 1)
        tasksRead.push(sleep(delay).then(() => runRead(i)))
    }
    await Promise.all(tasksRead)

    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        const delay = DELAY_MS * (i - 1)
        tasksUpdate.push(sleep(delay).then(() => runUpdate(i)))
    }
    await Promise.all(tasksUpdate)

    for (let i = 1; i <= TOTAL_REQUESTS; i++) {
        const delay = DELAY_MS * (i - 1)
        tasksDelete.push(sleep(delay).then(() => runDelete(i)))
    }
    await Promise.all(tasksDelete)

    printStat('CREATE', stats.create, stats.createFail)
    printStat('READ', stats.read, stats.readFail)
    printStat('UPDATE', stats.update, stats.updateFail)
    printStat('DELETE', stats.delete, stats.deleteFail)
}

runTest()