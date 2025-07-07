// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract StorageHealthRecords {
    struct HealthRecord {
        string id;// ID unik rekam medis
        address creatorAddress;// Alamat pembuat (dokter/pasien)
        string description;// Deskripsi rekam medis
        string cid;// Hash IPFS dari file rekam medis
        string recordType;// Jenis rekam medis
        string createdAt;// Timestamp pembuatan
        bool isActive;// Status aktif/hapus
        uint version;// Versi rekam (untuk tracking update)
        string previousId;// ID rekam sebelumnya (jika di-update)
    }

    struct User {
        string name;// Nama lengkap
        string birthDate; // Tanggal lahir
        string homeAddress;// Alamat fisik
        string aesKey;// Kunci enkripsi untuk data sensitif
        string passKey;// Kata sandi tambahan
        string role;// "Patient" atau "Doctor"
        address ethAddress;// Alamat Ethereum
    }

//Data spesifik peran
    struct Patient {
        address[] doctors;//Dokter yang diizinkan mengakses
        address[] doctorsPending;// Dokter yang menunggu persetujuan
        HealthRecord[] healthRecords;// Rekam medis aktif
        HealthRecord[] oldHealthRecords;// Rekam medis arsip (versi lama)
    } 

    struct Doctor {
        address[] patients;// Pasien yang diizinkan diakses
        address[] patientsPending;// Pasien menunggu persetujuan
    }

//Manajemen izin akses
    struct Access {
        bool isRequested;// Status permintaan akses
        bool canCreate;// Izin membuat rekam medis
        bool canRead;// Izin membaca rekam
        bool canUpdate;// Izin memperbarui rekam
        bool canDelete;// Izin menghapus rekam
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

    //menyimpan data rekam medis, pengguna, dan izin akses berdasarkan alamat Ethereum 
    mapping(address => User) private users;
    mapping(address => Patient) private patients;
    mapping(address => Doctor) private doctors;
    mapping(address => bool) private isPatientRegistered; 
    mapping(address => bool) private isDoctorRegistered;
    mapping(address => mapping(address => Access)) private doctorPermissions;
    mapping(address => mapping(address => Access)) private doctorRequestAccess;

    // Events
    //mencatat kejadian (log) ke dalam blockchain log system
    //Memudahkan tracking perubahan di frontend atau sistem eksternal
    //Event dalam Solidity adalah mekanisme notifikasi yang memungkinkan 
    //smart contract mengirim sinyal ke aplikasi eksternal (seperti frontend atau backend) ketika suatu aksi tertentu terjadi di blockchain.
    event PatientRegistered(address indexed patient); //Log ini dicatat saat seorang pasien berhasil mendaftar
    event DoctorRegistered(address indexed doctor);
    event AccessRequested(address indexed patient, address indexed doctor, bool canCreate, bool canRead, bool canUpdate, bool canDelete);
    event AccessApproved(address indexed patient, address indexed doctor, bool canCreate, bool canRead, bool canUpdate, bool canDelete);
    event AccessDenied(address indexed patient, address indexed doctor);
    event HealthRecordCreated(address indexed patient, string recordId);
    event HealthRecordUpdated(address indexed patient, string recordId);
    event HealthRecordDeleted(address indexed patient, string recordId);
    event HealthRecordRevertDeleted(address indexed patient, string recordId);
    event SendTest(address indexed creator, string message);

    // Modifiers
    modifier onlyRegisteredPatient(address patient) {
        require(isPatientRegistered[patient], "Patient not registered");
        _;
    }

    modifier onlyRegisteredDoctor(address doctor) {
        require(isDoctorRegistered[doctor], "Doctor not registered");
        _;
    }

    modifier onlyPatientOrDoctorWithAccess(address patient, address caller, bool requireCreate, bool requireRead, bool requireUpdate, bool requireDelete) {
        require(
            caller == patient || 
            (isDoctorRegistered[caller] && 
            (!requireCreate || doctorPermissions[patient][caller].canCreate) &&
            (!requireRead || doctorPermissions[patient][caller].canRead) &&
            (!requireUpdate || doctorPermissions[patient][caller].canUpdate) &&
            (!requireDelete || doctorPermissions[patient][caller].canDelete)),
            "Unauthorized access"
        );
        _;
    }

    //Registrasi Pengguna
    function registerUser(
        address senderAddress,
        string memory name, 
        string memory birthDate, 
        string memory homeAddress,
        string memory aesKey, 
        string memory passKey,
        string memory role
    ) external {
        //Menghasilkan nilai hash tetap (generate encrypt key)
        require(!isPatientRegistered[senderAddress] && !isDoctorRegistered[senderAddress], "User already registered");
        require(keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Patient")) || 
               keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Doctor")), 
               "Invalid role");

        users[senderAddress] = User({
            name: name,
            birthDate: birthDate,
            homeAddress: homeAddress,
            aesKey: aesKey,
            passKey: passKey,
            role: role,
            ethAddress: senderAddress
        });

        if (keccak256(abi.encodePacked(role)) == keccak256(abi.encodePacked("Patient"))) {
            registeredPatients.push(senderAddress);
            isPatientRegistered[senderAddress] = true;
            emit PatientRegistered(senderAddress);
        } else {
            registeredDoctors.push(senderAddress);
            isDoctorRegistered[senderAddress] = true;
            emit DoctorRegistered(senderAddress);
        }
    }

    // View Functions
    function checkIsUserRegistered(address addressUser) external view returns (bool) {
        return isPatientRegistered[addressUser] || isDoctorRegistered[addressUser];
    }

    function getUser(address userAddress) external view returns (User memory) {
        require(isPatientRegistered[userAddress] || isDoctorRegistered[userAddress], "User not registered");
        return users[userAddress];
    }

    function getAllRegisteredPatients() external view returns (address[] memory) {
        return registeredPatients;
    }

    function getAllRegisteredDoctors() external view returns (address[] memory) {
        return registeredDoctors;
    }

    // Patient Details
    function getPatientDetails(address patientAddress, address senderAddress) 
        external 
        view 
        onlyRegisteredPatient(patientAddress)
        returns (
            string memory name, 
            string memory birthDate, 
            string memory homeAddress, 
            string memory aesKey,
            string memory role,
            address[] memory doctorsApproved, 
            address[] memory doctorsPending, 
            HealthRecord[] memory healthRecords,
            HealthRecord[] memory oldHealthRecords
        ) 
    {
        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canRead),
            "Unauthorized access"
        );
        
        User memory user = users[patientAddress];
        Patient memory patient = patients[patientAddress];

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

    // Doctor Details
    function getDoctorDetails(address doctorAddress) 
        external 
        view 
        onlyRegisteredDoctor(doctorAddress)
        returns (
            string memory name, 
            string memory birthDate, 
            string memory homeAddress, 
            string memory aesKey,
            string memory role,
            address[] memory patientsApproved,
            address[] memory patientsPending
        ) 
    {
        User memory user = users[doctorAddress];
        Doctor memory doctor = doctors[doctorAddress];

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

    // Health Record CRUD Operations
    function createHealthRecord(
        address senderAddress,
        address patientAddress,
        string memory newRecordId,
        string memory description,
        string memory cid,
        string memory recordType,
        string memory createdAt
    ) external onlyRegisteredPatient(patientAddress) {
        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canCreate), 
            "Unauthorized access"
        );

        patients[patientAddress].healthRecords.push(HealthRecord({
            id: newRecordId,
            description: description,
            cid: cid,
            creatorAddress: senderAddress,
            recordType: recordType,
            createdAt: createdAt,
            isActive: true,
            version: 1,
            previousId: ""
        }));

        emit HealthRecordCreated(patientAddress, newRecordId);
    }

    function getHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) external view onlyRegisteredPatient(patientAddress) returns (HealthRecord memory) {
        HealthRecord[] memory records = patients[patientAddress].healthRecords;
        for (uint i = 0; i < records.length; i++) {
            if (keccak256(bytes(records[i].id)) == keccak256(bytes(recordId))) {
                require(
                    senderAddress == patientAddress || 
                    senderAddress == records[i].creatorAddress || 
                    (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canRead),
                    "Unauthorized access"
                );
                return records[i];
            }
        }
        revert("Health record not found");
    }

    function getHealthRecordsByAddress(address senderAddress, address patientAddress) 
        external 
        view 
        onlyRegisteredPatient(patientAddress) 
        returns (HealthRecord[] memory) 
    {
        require(isDoctorRegistered[senderAddress] || senderAddress == patientAddress, "Unauthorized access");
        return patients[patientAddress].healthRecords;
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
    ) external onlyRegisteredPatient(patientAddress) {
        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canUpdate), 
            "Unauthorized access"
        );

        Patient storage patient = patients[patientAddress];
        for (uint i = 0; i < patient.healthRecords.length; i++) {
            if (keccak256(bytes(patient.healthRecords[i].id)) == keccak256(bytes(recordId))) {
                // Archive old record
                patient.oldHealthRecords.push(HealthRecord({
                    id: recordId,
                    description: patient.healthRecords[i].description,
                    cid: patient.healthRecords[i].cid,
                    creatorAddress: patient.healthRecords[i].creatorAddress,
                    recordType: patient.healthRecords[i].recordType,
                    createdAt: patient.healthRecords[i].createdAt,
                    isActive: false,
                    version: patient.healthRecords[i].version,
                    previousId: patient.healthRecords[i].previousId
                }));

                // Update current record
                patient.healthRecords[i] = HealthRecord({
                    id: newRecordId,
                    description: description,
                    cid: cid,
                    creatorAddress: senderAddress,
                    recordType: recordType,
                    createdAt: createdAt,
                    isActive: true,
                    version: patient.healthRecords[i].version + 1,
                    previousId: recordId
                });

                emit HealthRecordUpdated(patientAddress, recordId);
                return;
            }
        }
        revert("Health record not found");
    }

    function deleteHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) external onlyRegisteredPatient(patientAddress) {
        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canDelete), 
            "Unauthorized access"
        );

        HealthRecord[] storage records = patients[patientAddress].healthRecords;
        for (uint i = 0; i < records.length; i++) {
            if (keccak256(bytes(records[i].id)) == keccak256(bytes(recordId))) {
                records[i].isActive = false;
                emit HealthRecordDeleted(patientAddress, recordId);
                return;
            }
        }
        revert("Health record not found");
    }

    function revertDeleteHealthRecord(
        address senderAddress,
        address patientAddress, 
        string memory recordId
    ) external onlyRegisteredPatient(patientAddress) {
        require(
            senderAddress == patientAddress || 
            (isDoctorRegistered[senderAddress] && doctorPermissions[patientAddress][senderAddress].canDelete), 
            "Unauthorized access"
        );

        HealthRecord[] storage records = patients[patientAddress].healthRecords;
        for (uint i = 0; i < records.length; i++) {
            if (keccak256(bytes(records[i].id)) == keccak256(bytes(recordId))) {
                records[i].isActive = true;
                emit HealthRecordRevertDeleted(patientAddress, recordId);
                return;
            }
        }
        revert("Health record not found");
    }

    // Permission Management
    // Pasien menyetujui akses dokter
    function permissionPatientGrantDoctor(
        address senderAddress,
        address doctorAddress, 
        bool canCreate, 
        bool canRead, 
        bool canUpdate, 
        bool canDelete
    ) external onlyRegisteredPatient(senderAddress) onlyRegisteredDoctor(doctorAddress) {
        _updateDoctorPermission(senderAddress, doctorAddress, canCreate, canRead, canUpdate, canDelete, true);
        emit AccessApproved(senderAddress, doctorAddress, canCreate, canRead, canUpdate, canDelete);
    }
//Pasien mencabut akses dokter
    function permissionPatientRevokeDoctor(
        address senderAddress,
        address doctorAddress
    ) external onlyRegisteredPatient(senderAddress) onlyRegisteredDoctor(doctorAddress) {
        _removeDoctorAccess(senderAddress, doctorAddress);
        emit AccessApproved(senderAddress, doctorAddress, false, false, false, false);
    }

    function requestAccessDoctor(
        address senderAddress,
        address patientAddress, 
        bool canCreate, 
        bool canRead, 
        bool canUpdate, 
        bool canDelete
    ) external onlyRegisteredDoctor(senderAddress) onlyRegisteredPatient(patientAddress) {
        doctorRequestAccess[patientAddress][senderAddress] = Access({
            isRequested: true,
            canCreate: canCreate,
            canRead: canRead,
            canUpdate: canUpdate,
            canDelete: canDelete
        });

        _addToPendingLists(patientAddress, senderAddress);
        emit AccessRequested(patientAddress, senderAddress, canCreate, canRead, canUpdate, canDelete);
    }

    function requestAccessApproved(
        address senderAddress,
        address doctorAddress
    ) external onlyRegisteredPatient(senderAddress) onlyRegisteredDoctor(doctorAddress) {
        Access memory request = doctorRequestAccess[senderAddress][doctorAddress];
        require(request.isRequested, "Access request not found");

        _updateDoctorPermission(senderAddress, doctorAddress, 
            request.canCreate, request.canRead, request.canUpdate, request.canDelete, true);
        emit AccessApproved(senderAddress, doctorAddress, 
            request.canCreate, request.canRead, request.canUpdate, request.canDelete);
    }

    function requestAccessDenied(
        address senderAddress,
        address doctorAddress
    ) external onlyRegisteredPatient(senderAddress) onlyRegisteredDoctor(doctorAddress) {
        require(doctorRequestAccess[senderAddress][doctorAddress].isRequested, "Access request not found");
        
        _removeFromPendingLists(senderAddress, doctorAddress);
        delete doctorRequestAccess[senderAddress][doctorAddress];
        emit AccessDenied(senderAddress, doctorAddress);
    }

    // Helper functions for permission management
    function _updateDoctorPermission(
        address patientAddress,
        address doctorAddress,
        bool canCreate,
        bool canRead,
        bool canUpdate,
        bool canDelete,
        bool addToApproved
    ) private {
        doctorPermissions[patientAddress][doctorAddress] = Access({
            isRequested: true,
            canCreate: canCreate,
            canRead: canRead,
            canUpdate: canUpdate,
            canDelete: canDelete
        });

        if (addToApproved) {
            _addToApprovedLists(patientAddress, doctorAddress);
        }
        _removeFromPendingLists(patientAddress, doctorAddress);
    }

    function _removeDoctorAccess(address patientAddress, address doctorAddress) private {
        delete doctorPermissions[patientAddress][doctorAddress];
        delete doctorRequestAccess[patientAddress][doctorAddress];
        _removeFromApprovedLists(patientAddress, doctorAddress);
        _removeFromPendingLists(patientAddress, doctorAddress);
    }
//Cek keberadaan alamat dalam array
    function _addToApprovedLists(address patientAddress, address doctorAddress) private {
        if (!_addressExists(patients[patientAddress].doctors, doctorAddress)) {
            patients[patientAddress].doctors.push(doctorAddress);
        }
        if (!_addressExists(doctors[doctorAddress].patients, patientAddress)) {
            doctors[doctorAddress].patients.push(patientAddress);
        }
    }

    function _removeFromApprovedLists(address patientAddress, address doctorAddress) private {
        _removeAddressFromArray(patients[patientAddress].doctors, doctorAddress);
        _removeAddressFromArray(doctors[doctorAddress].patients, patientAddress);
    }

    function _addToPendingLists(address patientAddress, address doctorAddress) private {
        if (!_addressExists(patients[patientAddress].doctorsPending, doctorAddress)) {
            patients[patientAddress].doctorsPending.push(doctorAddress);
        }
        if (!_addressExists(doctors[doctorAddress].patientsPending, patientAddress)) {
            doctors[doctorAddress].patientsPending.push(patientAddress);
        }
    }

    function _removeFromPendingLists(address patientAddress, address doctorAddress) private {
        _removeAddressFromArray(patients[patientAddress].doctorsPending, doctorAddress);
        _removeAddressFromArray(doctors[doctorAddress].patientsPending, patientAddress);
    }

    // View functions for permissions
    function getPatientDoctors(address patientAddress) 
        external 
        view 
        onlyRegisteredPatient(patientAddress)
        returns (AccessResponse[] memory approved, AccessResponse[] memory pending) 
    {
        return (_getAccessResponses(patients[patientAddress].doctors, patientAddress, true),
                _getAccessResponses(patients[patientAddress].doctorsPending, patientAddress, false));
    }

    function getDoctorPatients(address doctorAddress) 
        external 
        view 
        onlyRegisteredDoctor(doctorAddress)
        returns (AccessResponse[] memory approved, AccessResponse[] memory pending) 
    {
        return (_getAccessResponses(doctors[doctorAddress].patients, doctorAddress, true),
                _getAccessResponses(doctors[doctorAddress].patientsPending, doctorAddress, false));
    }

    function getDoctorPermission(address doctorAddress, address patientAddress) 
        external 
        view 
        onlyRegisteredPatient(patientAddress) 
        onlyRegisteredDoctor(doctorAddress)
        returns (AccessResponse memory) 
    {
        Access memory permission = doctorPermissions[patientAddress][doctorAddress];
        require(permission.isRequested, "Permission not found");
        
        return AccessResponse({
            userAddress: doctorAddress,
            canCreate: permission.canCreate,
            canRead: permission.canRead,
            canUpdate: permission.canUpdate,
            canDelete: permission.canDelete
        });
    }

    // Utility functions
    function _getAccessResponses(address[] memory addresses, address userAddress, bool isApproved) 
        private 
        view 
        returns (AccessResponse[] memory) 
    {
        AccessResponse[] memory responses = new AccessResponse[](addresses.length);
        for (uint i = 0; i < addresses.length; i++) {
            Access memory access = isApproved 
                ? doctorPermissions[userAddress][addresses[i]] 
                : doctorRequestAccess[userAddress][addresses[i]];
            
            responses[i] = AccessResponse({
                userAddress: addresses[i],
                canCreate: access.canCreate,
                canRead: access.canRead,
                canUpdate: access.canUpdate,
                canDelete: access.canDelete
            });
        }
        return responses;
    }

    function _addressExists(address[] storage array, address addr) private view returns (bool) {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == addr) {
                return true;
            }
        }
        return false;
    }

    function _removeAddressFromArray(address[] storage array, address addr) private {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == addr) {
                array[i] = array[array.length - 1];
                array.pop();
                return;
            }
        }
    }
//Konversi alamat Ethereum ke string (untuk frontend)
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

    // Test function
    function testSendTransaction(string memory message) external {
        emit SendTest(msg.sender, message);
    }
}