const axios = require('axios');
const { performance } = require('perf_hooks');

// KONFIGURASI UJI COBA
const TOTAL_REQUESTS = 10;
const DELAY_MS = 5000;
const BASE_URL = 'http://localhost:4001/v1';

// MULTI PASIEN DAN TOKEN
const PATIENTS = [
  {
    address: '0xf51de12261F60B677fdf4306B6FF54dC98aeAcA3',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHhmNTFkZTEyMjYxRjYwQjY3N2ZkZjQzMDZCNkZGNTRkQzk4YWVBY0EzIiwiaWF0IjoxNzQ5NjI1NzQ1fQ.nDCPB3ikBlM-dcTWGofalBkuLT1DlTcquym7eVNo-3Q'
  },
  {
    address: '0xd493D316826F3CE7dCa74c25e01E5c23B91FFd9E',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHhkNDkzRDMxNjgyNkYzQ0U3ZENhNzRjMjVlMDFFNWMyM0I5MUZGZDlFIiwiaWF0IjoxNzQ5NjI1NzcwfQ.u4RU2Cv8MZPAeZzqlKcfPjJdh3MHLGSp4KMO__PcH04'
  },
  {
    address: '0x71e8d308405ee9eF02373eBdf5F11d40809Fe067',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHg3MWU4ZDMwODQwNWVlOWVGMDIzNzNlQmRmNUYxMWQ0MDgwOUZlMDY3IiwiaWF0IjoxNzQ5NjI1Nzk1fQ.KHjxgklGHuTdigopGPUnW6opzmAXL0jWu6fNsADdX9k'
  }
];

let successCount = 0;
let failureCount = 0;
let totalTime = 0;
let allTimes = [];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getHealthRecord(i, patient) {
  const start = performance.now();
  try {
    // PERUBAHAN PENTING: Format URL yang benar dengan backticks
    const res = await axios.get(`${BASE_URL}/health-records/${patient.address}`, {
      headers: {
        Authorization: patient.token
      }
    });

    const end = performance.now();
    const time = end - start;

    successCount++;
    totalTime += time;
    allTimes.push(time);
    console.log(`[${i}] Success - ${Math.round(time)} ms`);
    console.log(`    ↳ Status: ${res.status} - ${res.statusText}`);
    console.log(`    ↳ Data Length: ${res.data?.length || 0} records`);
  } catch (err) {
    const end = performance.now();
    const time = end - start;

    failureCount++;
    allTimes.push(time);

    console.log(`[${i}] Failed  - ${Math.round(time)} ms`);
    if (err.response) {
      console.log(`    ↳ ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    } else if (err.request) {
      console.log('    ↳ No response received from server');
    } else {
      console.log('    ↳ Error:', err.message);
    }
  }
}

async function runTest() {
  console.log('Memulai pengujian GET Health Record...\n');
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const patient = PATIENTS[(i - 1) % PATIENTS.length]; // Fixed modulo calculation
    await getHealthRecord(i, patient);
    if (i < TOTAL_REQUESTS) await sleep(DELAY_MS);
  }

  // Hitung statistik
  const avg = totalTime / (successCount || 1);
  const max = Math.max(...allTimes);
  const min = Math.min(...allTimes);
  const throughput = successCount / (totalTime / 1000);
  const errorRate = (failureCount / TOTAL_REQUESTS) * 100;

  console.log(`\n📊 Hasil Pengujian GET Health Record`);
  console.log(`Total Requests   : ${TOTAL_REQUESTS}`);
  console.log(`Success          : ${successCount}`);
  console.log(`Failure          : ${failureCount}`);
  console.log(`Average Time     : ${avg.toFixed(2)} ms`);
  console.log(`Min Time         : ${min.toFixed(2)} ms`);
  console.log(`Max Time         : ${max.toFixed(2)} ms`);
  console.log(`Throughput       : ${throughput.toFixed(2)} req/sec`);
  console.log(`Error Rate       : ${errorRate.toFixed(2)} %`);
}

runTest();