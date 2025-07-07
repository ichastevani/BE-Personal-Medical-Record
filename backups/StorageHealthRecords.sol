// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract StorageHealthRecords {
    // Data untuk catatan kesehatan
    struct HealthRecord {
        string id;             // ID catatan kesehatan
        address creatorAddress; // addres blockchain dari pembuat catatan kesehatan
        string description;     // Deskripsi
        string cid;             // CID files from IPFS
        string recordType;      // Tipe Catatan: Laboratory Test, Vaccination, Radiology, Health Record, Health Facility, Treatment History
        string createdAt;       // Tanggal pembuatan catatan kesehatan
        bool isActive;          // Flag sebagai indikasi apakah catatan masih berlaku
        uint version;           // Versi dari catatan kesehatan - untuk fitur update
        string previousId;     // Id dari catatan kesehatan sebelumnya
    }

    // Data untuk pengguna aplikasi
    struct User {
        string name;        // Nama
        string birthDate;   // Tanggal Lahir
        string homeAddress; // Alamat rumah pengguna
        string aesKey;      // Kunci AES untuk melakukan enkripsi dan deskripsi file
        string passKey;     // Kata sandi pengguna
        string role;        // Hak akses pengguna [Patient, Doctor]
        address ethAddress; // Alamat publik ETH pengguna
    }

    // Data pengguna dengan hak akses sebagai pasien
    struct Patient {
        address[] doctors;                 // Daftar dokter yang memiliki akses
        address[] doctorsPending;          // Daftar dokter yang melakukan request akses
        HealthRecord[] healthRecords;      // Daftar catatan kesehatan pengguna
        HealthRecord[] oldHealthRecords;   // Daftar catatan kesehatan lama
    } 

    // Data pengguna dengan hak akses sebagai dokter
    struct Doctor {
        address[] patients;        // Daftar pengguna yang memberikan akses
        address[] patientsPending; // Daftar pengguna yang telah diminta akses
    }

    struct Access {
        bool isRequested;
        bool canCreate;
        bool canRead;
        bool canUpdate;
        bool canDelete;
    }

    struct AccessResponse {
        address userAddress;
        bool canCreate;
        bool canRead;
        bool canUpdate;
        bool canDelete;
    }

    address[] private registeredPatients;
    address[] private registeredDoctors;

    // Mapping
    mapping(address => User) private users;       // Daftar pengguna yang terdaftar
    mapping(address => Patient) private patients; // Daftar pengguna sebagai pasien yang terdaftar
    mapping(address => Doctor) private doctors;   // Daftar pengguna sebagai dokter yang terdaftar

    mapping(address => bool) private isPatientRegistered; 
    mapping(address => bool) private isDoctorRegistered;

    mapping(address => mapping(address => Access)) private doctorPermissions; // patient -> doctor -> permissions
    mapping(address => mapping(address => Access)) private doctorRequestAccess; // patient -> doctor -> requests access

    // Events
    event PatientRegistered(address patient); 
    event DoctorRegistered(address doctor);

    event AccessRequested(address patient, address doctor, bool canCreate, bool canRead, bool canUpdate, bool canDelete);
    event AccessApproved(address patient, address doctor, bool canCreate, bool canRead, bool canUpdate, bool canDelete);
    event AccessDenied(address patient, address doctor);

    event HealthRecordCreated(address patient, string recordId);
    event HealthRecordUpdated(address patient, string recordId);
    event HealthRecordDeleted(address patient, string recordId);
    event HealthRecordRevertDeleted(address patient, string recordId);

    // Melakukan pendaftaran user
    function registerUser(
        address senderAddress,
        string memory name, 
        string memory birthDate, 
        string memory homeAddress,
        string memory aesKey, 
        string memory passKey,
        string memory role
    ) public {
        require(!isPatientRegistered[senderAddress], "Pengguna telah terdaftar sebagai pasien");
        require(!isDoctorRegistered[senderAddress], "Pengguna telah terdaftar sebagai dokter");

        // Periksa role pengguna yang mendaftar
        require(
            keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Patient")) ||
            keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Doctor")),
            "Pengguna harus merupakan Pasien atau Dokter"
        );

        User storage newUser = users[senderAddress];
        newUser.name = name;
        newUser.birthDate = birthDate;
        newUser.homeAddress = homeAddress;
        newUser.aesKey = aesKey;
        newUser.passKey = passKey;
        newUser.role = role;
        newUser.ethAddress = senderAddress;

        if (keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Patient"))) {
            patients[senderAddress];
            registeredPatients.push(senderAddress);
            isPatientRegistered[senderAddress] = true;
            emit PatientRegistered(senderAddress);
        } else if (keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Doctor"))) {
            doctors[senderAddress];
            registeredDoctors.push(senderAddress);
            isDoctorRegistered[senderAddress] = true;
            emit DoctorRegistered(senderAddress);
        } else {
            revert("Role tidak valid");
        }
    }

    // Periksa apakah pengguna telah terdaftar
    function checkIsUserRegistered(address addressUser) public view returns (bool) {
        return isPatientRegistered[addressUser] || isDoctorRegistered[addressUser];
    }

    function getUser(address userAddress) public view returns (User memory) {
        require(isPatientRegistered[userAddress] || isDoctorRegistered[userAddress], "Pengguna belum terdaftar");
        User storage user = users[userAddress];
        return user;
    }

    // Mengambil semua address penguna yang terdaftar sebagai pasien
    function getAllRegisteredPatients() public view returns (address[] memory) {
        return registeredPatients;
    }

    // Mengambil semua address penguna yang terdaftar sebagai dokter
    function getAllRegisteredDoctors() public view returns (address[] memory) {
        return registeredDoctors;
    }
    
    // GETTING INFO
    // Mengambil detail pasien
    function getPatientDetails(address patientAddress, address senderAddress) public view returns (
        string memory name, 
        string memory birthDate, 
        string memory homeAddress, 
        string memory aesKey,
        string memory role,
        address[] memory doctorsApproved, 
        address[] memory doctorsPending, 
        HealthRecord[] memory healthRecords,
        HealthRecord[] memory oldHealthRecords
    ) {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");

        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canRead),
            "Tidak mempunyai hak akses"
        );
        
        User storage user = users[patientAddress];
        Patient storage patient = patients[patientAddress];

        return ( 
            user.name, 
            user.birthDate, 
            user.homeAddress, 
            user.aesKey,
            user.role, 
            patient.doctors, 
            patient.doctorsPending, 
            patient.healthRecords,
            patient.oldHealthRecords
        );
    }

    // Mengambil detail docter
    function getDoctorDetails(address doctorAddress) public view returns (
        string memory name, 
        string memory birthDate, 
        string memory homeAddress, 
        string memory aesKey,
        string memory role,
        address[] memory patientsApproved,
        address[] memory patientsPending
    ) {
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        User storage user = users[doctorAddress];
        Doctor storage doctor = doctors[doctorAddress];

        return (
            user.name, 
            user.birthDate, 
            user.homeAddress, 
            user.aesKey,
            user.role,
            doctor.patients,
            doctor.patientsPending
        );
    }

    // HEALTH RECORD CRUD
    // Menambahkan data catatan kesehatan
    function createHealthRecord(
        address senderAddress,
        address patientAddress,
        string memory newRecordId,
        string memory description,
        string memory cid,
        string memory recordType,
        string memory createdAt
    ) public {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(senderAddress == patientAddress || (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canCreate), "Tidak mempunyai hak akses");

        Patient storage patient = patients[patientAddress];
        
        HealthRecord memory newRecord = HealthRecord({
            id: newRecordId,
            description: description,
            cid: cid,
            creatorAddress: senderAddress,
            recordType: recordType,
            createdAt: createdAt,
            isActive: true,
            version: 1,
            previousId: ""
        });

        patient.healthRecords.push(newRecord);

        emit HealthRecordCreated(patientAddress, newRecordId);
    }

    // Mengambil data health record
    function getHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) public view returns (HealthRecord memory) {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");

        Patient storage patient = patients[patientAddress];
        for (uint i = 0; i < patient.healthRecords.length; i++) {
            if (keccak256(bytes(patient.healthRecords[i].id)) == keccak256(bytes(recordId))) {
                if(senderAddress == patientAddress || senderAddress == patient.healthRecords[i].creatorAddress || (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canRead)) {
                    return patient.healthRecords[i];
                }
            }
        }
        revert("Catatan kesehatan tidak tersedia");
    }

    // Mengambil data catatan berdasarkan address
    function getHealthRecordsByAddress(address senderAddress, address patientAddress) public view returns (HealthRecord[] memory) {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[senderAddress] || senderAddress == patientAddress, "Akses ditolak");

        Patient storage patient = patients[patientAddress];
        return patient.healthRecords;
    }

    function updateHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory newRecordId,
        string memory recordId, 
        string memory description, 
        string memory cid,
        string memory recordType,
        string memory createdAt
    ) public {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(senderAddress == patientAddress || (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canUpdate), "Tidak mempunyai hak akses");

        Patient storage patient = patients[patientAddress];
        for (uint i = 0; i < patient.healthRecords.length; i++) {
            if (keccak256(bytes(patient.healthRecords[i].id)) == keccak256(bytes(recordId))) {
                // Simpan catatan kesehatan sebelumnya ke data lama
                HealthRecord memory newRecord = HealthRecord({
                    id: recordId,
                    description: patient.healthRecords[i].description,
                    cid:  patient.healthRecords[i].cid,
                    creatorAddress:  patient.healthRecords[i].creatorAddress,
                    recordType:  patient.healthRecords[i].recordType,
                    createdAt:  patient.healthRecords[i].createdAt,
                    isActive:  false,
                    version: patient.healthRecords[i].version,
                    previousId:  patient.healthRecords[i].previousId
                });
                patient.oldHealthRecords.push(newRecord);

                patient.healthRecords[i].id = newRecordId;
                patient.healthRecords[i].description = description;
                patient.healthRecords[i].cid = cid;
                patient.healthRecords[i].creatorAddress = senderAddress;
                patient.healthRecords[i].recordType = recordType;
                patient.healthRecords[i].createdAt = createdAt;
                patient.healthRecords[i].isActive = true;
                patient.healthRecords[i].version += 1;
                patient.healthRecords[i].previousId = recordId;

                emit HealthRecordUpdated(patientAddress, recordId);
                return;
            }
        }
        revert("Catatan kesehatan tidak tersedia");
    }

    function deleteHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) public {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(senderAddress == patientAddress || (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canDelete), "Tidak mempunyai hak akses");

        Patient storage patient = patients[patientAddress];
        for (uint i = 0; i < patient.healthRecords.length; i++) {
            if (keccak256(bytes(patient.healthRecords[i].id)) == keccak256(bytes(recordId))) {
                patient.healthRecords[i].isActive = false;

                emit HealthRecordDeleted(patientAddress, recordId);
                return;
            }
        }
        revert("Catatan kesehatan tidak tersedia");
    }

    function revertDeleteHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) public {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(senderAddress == patientAddress || (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canDelete), "Tidak mempunyai hak akses");

        Patient storage patient = patients[patientAddress];
        for (uint i = 0; i < patient.healthRecords.length; i++) {
            if (keccak256(bytes(patient.healthRecords[i].id)) == keccak256(bytes(recordId))) {
                patient.healthRecords[i].isActive = true;

                emit HealthRecordRevertDeleted(patientAddress, recordId);
                return;
            }
        }
        revert("Catatan kesehatan tidak tersedia");
    }

    // PERMISSION MANAGEMENT FUNCTIONS

    // Pasien memberikan izin kepada dokter
    function permissionPatientGrantDoctor(
        address senderAddress,
        address doctorAddress, 
        bool canCreate, 
        bool canRead, 
        bool canUpdate, 
        bool canDelete
    ) public {
        require(isPatientRegistered[senderAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        delete doctorRequestAccess[senderAddress][doctorAddress];
        doctorPermissions[senderAddress][doctorAddress] = Access({
            isRequested: true,
            canCreate: canCreate,
            canRead: canRead,
            canUpdate: canUpdate,
            canDelete: canDelete
        });

        // Tambahkan address dokter jika belum terdapat dalam daftar dokter yang telah di approve
        if (!addressExists(patients[senderAddress].doctors, doctorAddress)) {
            patients[senderAddress].doctors.push(doctorAddress);
        }

        // Tambahkan address pasien ke dalam dafttar pasien dokter
        if (!addressExists(doctors[doctorAddress].patients, senderAddress)) {
            doctors[doctorAddress].patients.push(senderAddress);
        }
        
        // Hapus address dokter dari daftar pending
        address[] storage doctorList = patients[senderAddress].doctorsPending;
        for (uint i = 0; i < doctorList.length; i++) {
            if (doctorList[i] == doctorAddress) {
                doctorList[i] = doctorList[doctorList.length - 1];
                doctorList.pop();
                break;
            }
        }

        // Hapus address patient dari daftar pending
        address[] storage patientList = doctors[doctorAddress].patientsPending;
        for (uint i = 0; i < patientList.length; i++) {
            if (patientList[i] == doctorAddress) {
                patientList[i] = patientList[patientList.length - 1];
                patientList.pop();
                break;
            }
        }

        emit AccessApproved(senderAddress, doctorAddress, canCreate, canRead, canUpdate, canDelete);
    }

    // Pasien menolak memberikan izin kepada dokter
    function permissionPatientRevokeDoctor(
        address senderAddress,
        address doctorAddress
    ) public {
        require(isPatientRegistered[senderAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        delete doctorRequestAccess[senderAddress][doctorAddress];
        delete doctorPermissions[senderAddress][doctorAddress];

        // Menghapus dokter dari daftar pengguna
        address[] storage doctorList = patients[senderAddress].doctors;
        for (uint i = 0; i < doctorList.length; i++) {
            if (doctorList[i] == doctorAddress) {
                doctorList[i] = doctorList[doctorList.length - 1];
                doctorList.pop();
                break;
            }
        }

        // Menghapus pasien dari daftar dokter
        address[] storage patientList = doctors[doctorAddress].patients;
        for (uint i = 0; i < patientList.length; i++) {
            if (patientList[i] == senderAddress) {
                patientList[i] = patientList[patientList.length - 1];
                patientList.pop();
                break;
            }
        }

        // Hapus address dokter dari daftar pending
        address[] storage doctorPendingList = patients[senderAddress].doctorsPending;
        for (uint i = 0; i < doctorPendingList.length; i++) {
            if (doctorPendingList[i] == doctorAddress) {
                doctorPendingList[i] = doctorPendingList[doctorPendingList.length - 1];
                doctorPendingList.pop();
                break;
            }
        }

        // Hapus address patient dari daftar pending
        address[] storage patientPendingList = doctors[doctorAddress].patientsPending;
        for (uint i = 0; i < patientPendingList.length; i++) {
            if (patientPendingList[i] == doctorAddress) {
                patientPendingList[i] = patientPendingList[patientPendingList.length - 1];
                patientPendingList.pop();
                break;
            }
        }

        emit AccessApproved(senderAddress, doctorAddress, false, false, false, false);
    }

    // Doctor requests access to a patient's records
    function requestAccessDoctor(
        address senderAddress,
        address patientAddress, 
        bool canCreate, 
        bool canRead, 
        bool canUpdate, 
        bool canDelete
    ) public {
        require(isDoctorRegistered[senderAddress], "Dokter belum terdaftar");
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");

        delete doctorPermissions[patientAddress][senderAddress];
        doctorRequestAccess[patientAddress][senderAddress] = Access({
            isRequested: true,
            canCreate: canCreate,
            canRead: canRead,
            canUpdate: canUpdate,
            canDelete: canDelete
        });

        // Menghapus dokter dari daftar pengguna
        address[] storage doctorList = patients[patientAddress].doctors;
        for (uint i = 0; i < doctorList.length; i++) {
            if (doctorList[i] == senderAddress) {
                doctorList[i] = doctorList[doctorList.length - 1];
                doctorList.pop();
                break;
            }
        }

        // Menghapus pasien dari daftar dokter
        address[] storage patientList = doctors[senderAddress].patients;
        for (uint i = 0; i < patientList.length; i++) {
            if (patientList[i] == patientAddress) {
                patientList[i] = patientList[patientList.length - 1];
                patientList.pop();
                break;
            }
        }

        // Tambahkan address dokter ke daftar pending
        if (!addressExists(patients[patientAddress].doctorsPending, senderAddress)) {
            patients[patientAddress].doctorsPending.push(senderAddress);
        }

        // Tambahkan address pasien ke daftar pending
        if (!addressExists(doctors[senderAddress].patientsPending, patientAddress)) {
            doctors[senderAddress].patientsPending.push(patientAddress);
        }

        emit AccessRequested(patientAddress, senderAddress, canCreate, canRead, canUpdate, canDelete);
    }

    // Patient approves a doctor's access request
    function requestAccessApproved(
        address senderAddress,
        address doctorAddress
    ) public {
        require(isPatientRegistered[senderAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        Access storage request = doctorRequestAccess[senderAddress][doctorAddress];
        require(request.isRequested, "Permintaan akses dari dokter tidak tersedia");

        doctorPermissions[senderAddress][doctorAddress] = Access({
            isRequested: true,
            canCreate: request.canCreate,
            canRead: request.canRead,
            canUpdate: request.canUpdate,
            canDelete: request.canDelete
        });
        delete doctorRequestAccess[senderAddress][doctorAddress];

        // Tambahkan address dokter jika belum terdapat dalam daftar dokter yang telah di approve
        if (!addressExists(patients[senderAddress].doctors, doctorAddress)) {
            patients[senderAddress].doctors.push(doctorAddress);
        }

        // Tambahkan address pasien ke dalam dafttar pasien dokter
        if (!addressExists(doctors[doctorAddress].patients, senderAddress)) {
            doctors[doctorAddress].patients.push(senderAddress);
        }
        
        // Hapus address dokter dari daftar pending
        address[] storage doctorList = patients[senderAddress].doctorsPending;
        for (uint i = 0; i < doctorList.length; i++) {
            if (doctorList[i] == doctorAddress) {
                doctorList[i] = doctorList[doctorList.length - 1];
                doctorList.pop();
                break;
            }
        }

        // Hapus address patient dari daftar pending
        address[] storage patientList = doctors[doctorAddress].patientsPending;
        for (uint i = 0; i < patientList.length; i++) {
            if (patientList[i] == senderAddress) {
                patientList[i] = patientList[patientList.length - 1];
                patientList.pop();
                break;
            }
        }

        emit AccessApproved(senderAddress, doctorAddress, request.canCreate, request.canRead, request.canUpdate, request.canDelete);
    }

    // Patient denies a doctor's access request
    function requestAccessDenied(
        address senderAddress,
        address doctorAddress
    ) public {
        require(isPatientRegistered[senderAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        Access storage request = doctorRequestAccess[senderAddress][doctorAddress];
        require(request.isRequested, "Permintaan akses dari dokter tidak tersedia");

        delete doctorRequestAccess[senderAddress][doctorAddress];

        // Hapus address dokter dari daftar pending
        address[] storage doctorList = patients[senderAddress].doctorsPending;
        for (uint i = 0; i < doctorList.length; i++) {
            if (doctorList[i] == doctorAddress) {
                doctorList[i] = doctorList[doctorList.length - 1];
                doctorList.pop();
                break;
            }
        }

        // Hapus address patient dari daftar pending
        address[] storage patientList = doctors[doctorAddress].patientsPending;
        for (uint i = 0; i < patientList.length; i++) {
            if (patientList[i] == senderAddress) {
                patientList[i] = patientList[patientList.length - 1];
                patientList.pop();
                break;
            }
        }

        emit AccessDenied(senderAddress, doctorAddress);
    }

    // Utility function to check if an address exists in an array
    function addressExists(address[] storage array, address addr) internal view returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == addr) {
                return true;
            }
        }
        return false;
    }

    // getPatientDoctors
    function getPatientDoctors(
        address patientAddress
    ) public view returns (AccessResponse[] memory, AccessResponse[] memory) {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");

        uint totalApproved = patients[patientAddress].doctors.length;
        AccessResponse[] memory dataApproved = new AccessResponse[](totalApproved);
        for (uint i = 0; i < totalApproved; i++) {
            address doctorAddress = patients[patientAddress].doctors[i];
            Access memory request = doctorPermissions[patientAddress][doctorAddress];
            dataApproved[i] = AccessResponse({
                userAddress: doctorAddress,
                canCreate: request.canCreate,
                canRead: request.canRead,
                canUpdate: request.canUpdate,
                canDelete: request.canDelete
            });
        }

        uint totalPending = patients[patientAddress].doctorsPending.length;
        AccessResponse[] memory dataPending = new AccessResponse[](totalPending);
        for (uint i = 0; i < totalPending; i++) { // FIX: Gunakan totalPending
            address doctorAddress = patients[patientAddress].doctorsPending[i];
            Access memory request = doctorRequestAccess[patientAddress][doctorAddress];
            dataPending[i] = AccessResponse({
                userAddress: doctorAddress,
                canCreate: request.canCreate,
                canRead: request.canRead,
                canUpdate: request.canUpdate,
                canDelete: request.canDelete
            });
        }

        return (dataApproved, dataPending);
    }

    // getDoctorPatients
    function getDoctorPatients(
        address doctorAddress
    ) public view returns (AccessResponse[] memory, AccessResponse[] memory) {
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

        uint totalApproved = doctors[doctorAddress].patients.length;
        AccessResponse[] memory dataApproved = new AccessResponse[](totalApproved);
        for (uint i = 0; i < totalApproved; i++) {
            address patientAddress = doctors[doctorAddress].patients[i];
            Access memory request = doctorPermissions[patientAddress][doctorAddress];
            dataApproved[i] = AccessResponse({
                userAddress: patientAddress,
                canCreate: request.canCreate,
                canRead: request.canRead,
                canUpdate: request.canUpdate,
                canDelete: request.canDelete
            });
        }

        uint totalPending = doctors[doctorAddress].patientsPending.length;
        AccessResponse[] memory dataPending = new AccessResponse[](totalPending);
        for (uint i = 0; i < totalPending; i++) { // FIX: Gunakan totalPending
            address patientAddress = doctors[doctorAddress].patientsPending[i];
            Access memory request = doctorRequestAccess[patientAddress][doctorAddress];
            dataPending[i] = AccessResponse({
                userAddress: patientAddress,
                canCreate: request.canCreate,
                canRead: request.canRead,
                canUpdate: request.canUpdate,
                canDelete: request.canDelete
            });
        }

        return (dataApproved, dataPending);
    }

    // getDoctorPermission
    function getDoctorPermission(
        address doctorAddress, 
        address patientAddress
    ) public view returns (AccessResponse memory) {
        require(isPatientRegistered[patientAddress], "Pasien belum terdaftar");
        require(isDoctorRegistered[doctorAddress], "Dokter belum terdaftar");

         Access memory request = doctorPermissions[patientAddress][doctorAddress];
         if(request.isRequested) {
            return AccessResponse({
                userAddress: doctorAddress,
                canCreate: request.canCreate,
                canRead: request.canRead,
                canUpdate: request.canUpdate,
                canDelete: request.canDelete
            });
         }
            
        revert("Data permission tidak tersedia");
    }

    // Utils
    function addressToString(address addr) public pure returns (string memory) {
        bytes memory addressBytes = abi.encodePacked(addr);
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(42);

        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = hexChars[uint(uint8(addressBytes[i] >> 4))];
            str[3 + i * 2] = hexChars[uint(uint8(addressBytes[i] & 0x0f))];
        }
        return string(str);
    }

    // Fungsi ini hanya untuk tujuan pengujian
    event SendTest(address creator, string message); 
    function testSendTransaction(string memory message) public {
        emit SendTest(msg.sender, message);
    }
}
