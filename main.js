import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- IMPORTANT: REPLACE WITH YOUR FIREBASE CONFIG ---
// This is where you will paste the code from your Firebase console.
const firebaseConfig = {
    apiKey: "AIzaSyBCDun9-yoZvZDWMwqqJIv4Txmxb2pNmSw",
    authDomain: "jabadrents.firebaseapp.com",
    projectId: "jabadrents",
    storageBucket: "jabadrents.firebasestorage.app",
    messagingSenderId: "564640290953",
    appId: "1:564640290953:web:b3edf2a0944401dbd84e58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UI Elements ---
const appContainer = document.getElementById('app-container');
const loginRegisterView = document.getElementById('login-register-view');
const adminDashboard = document.getElementById('admin-dashboard');
const schoolAdminDashboard = document.getElementById('school-admin-dashboard');
const userDashboard = document.getElementById('user-dashboard');
const publicDeviceFormView = document.getElementById('public-device-form-view');
const loadingSpinner = document.getElementById('loading-spinner');

const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const toggleAuthBtn = document.getElementById('toggle-auth');
const registerSchoolBtn = document.getElementById('register-school-btn');
const authMessage = document.getElementById('auth-message');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const adminLogoutBtn = document.getElementById('admin-logout-btn');
const schoolAdminLogoutBtn = document.getElementById('school-admin-logout-btn');
const userLogoutBtn = document.getElementById('user-logout-btn');

const userList = document.getElementById('user-list');
const deviceList = document.getElementById('device-list');
const schoolList = document.getElementById('school-list');
const schoolAdminTitle = document.getElementById('school-admin-title');
const deviceFormLink = document.getElementById('device-form-link');
const schoolUserList = document.getElementById('school-user-list');
const schoolDeviceList = document.getElementById('school-device-list');
const myDeviceList = document.getElementById('my-device-list');
const userEmailDisplay = document.getElementById('user-email-display');
const userRoleDisplay = document.getElementById('user-role-display');
const userSchoolDisplay = document.getElementById('user-school-display');

const schoolModal = document.getElementById('school-modal');
const closeSchoolModalBtn = document.getElementById('close-school-modal');
const schoolForm = document.getElementById('school-form');
const schoolNameInput = document.getElementById('school-name-input');
const schoolAdminEmailInput = document.getElementById('school-admin-email');
const schoolAdminPasswordInput = document.getElementById('school-admin-password');
const schoolFormMessage = document.getElementById('school-form-message');
const publicDeviceForm = document.getElementById('public-device-form');
const publicDeviceNameInput = document.getElementById('public-device-name');
const publicUserEmailInput = document.getElementById('public-user-email');
const publicFormTitle = document.getElementById('public-form-title');
const publicFormMessage = document.getElementById('public-form-message');
const goHomeBtn = document.getElementById('go-home-btn');

// --- State Variables ---
let isLogin = true;

// --- Helper Functions ---
function showLoading(show) {
    loadingSpinner.classList.toggle('hidden', !show);
    appContainer.classList.toggle('hidden', show);
}

function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';
}

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params.entries());
}

function setupListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            if (confirm(`Are you sure you want to delete this ${type}?`)) {
                try {
                    const batch = writeBatch(db);
                    
                    if (type === 'schools') {
                        // Get all users and devices associated with the school
                        const usersQuery = query(collection(db, "users"), where("schoolId", "==", id));
                        const devicesQuery = query(collection(db, "devices"), where("schoolId", "==", id));
                        const [usersSnapshot, devicesSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(devicesQuery)]);
                        
                        // Delete all associated users and devices in a batch
                        usersSnapshot.forEach(userDoc => batch.delete(userDoc.ref));
                        devicesSnapshot.forEach(deviceDoc => batch.delete(deviceDoc.ref));
                        
                        // Delete the school itself
                        batch.delete(doc(db, "schools", id));

                    } else if (type === 'users') {
                        // Get all devices owned by the user
                        const devicesQuery = query(collection(db, "devices"), where("ownerId", "==", id));
                        const devicesSnapshot = await getDocs(devicesQuery);

                        // Delete all associated devices
                        devicesSnapshot.forEach(deviceDoc => batch.delete(deviceDoc.ref));

                        // Delete the user
                        batch.delete(doc(db, "users", id));

                    } else if (type === 'devices' || type === 'my-devices') {
                        // Find the user associated with the device and update their document
                        const usersQuery = query(collection(db, "users"), where("associatedDeviceIds", "array-contains", id));
                        const usersSnapshot = await getDocs(usersQuery);
                        if (!usersSnapshot.empty) {
                            const userDocRef = usersSnapshot.docs[0].ref;
                            const newDeviceIds = usersSnapshot.docs[0].data().associatedDeviceIds.filter(deviceId => deviceId !== id);
                            batch.update(userDocRef, { associatedDeviceIds: newDeviceIds });
                        }
                        
                        // Delete the device
                        batch.delete(doc(db, "devices", id));
                    }
                    
                    await batch.commit();
                    await refreshDashboard();
                } catch (error) {
                    console.error("Error deleting item:", error);
                    alert("Failed to delete. Please try again.");
                }
            }
        });
    });

    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const deviceId = e.target.dataset.deviceId;
            const newStatus = e.target.value;
            try {
                await updateDoc(doc(db, "devices", deviceId), { status: newStatus });
            } catch (error) {
                console.error("Error updating device status:", error);
            }
        });
    });
}

// --- Dynamic Table Creation ---
function createTableHTML(data, type, currentUserId) {
    if (!data || data.length === 0) {
        return `<p class="text-gray-500">No ${type} found.</p>`;
    }
    
    let headers;
    let getRowData;

    switch (type) {
        case 'users':
        case 'school-users':
            headers = ['Email', 'Role'];
            getRowData = (item) => [item.email, item.role.replace('-', ' ')];
            break;
        case 'schools':
            headers = ['Name', 'Admin Email'];
            getRowData = async (item) => {
                const adminDoc = await getDoc(doc(db, "users", item.adminUserId));
                return [item.name, adminDoc.exists() ? adminDoc.data().email : 'N/A'];
            };
            break;
        case 'devices':
        case 'school-devices':
            headers = ['Name', 'Owner Email', 'Status'];
            getRowData = async (item) => {
                const ownerDoc = await getDoc(doc(db, "users", item.ownerId));
                const ownerEmail = ownerDoc.exists() ? ownerDoc.data().email : 'N/A';
                return [item.name, ownerEmail, item.status];
            };
            break;
        case 'my-devices':
            headers = ['Name', 'Status'];
            getRowData = (item) => [item.name, item.status];
            break;
        default:
            return '';
    }

    const tableHeaderHtml = headers.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`).join('');
    
    let rowsHtml = '';
    
    // Using a promise-based approach to resolve owner emails
    const promises = data.map(async (item) => {
        const rowData = await getRowData(item);
        const cellsHtml = rowData.map(cell => {
            if (cell === 'online' || cell === 'offline') {
                const statusColor = cell === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><span class="py-1 px-3 text-xs font-semibold rounded-full ${statusColor}">${cell}</span></td>`;
            }
            return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${cell}</td>`;
        }).join('');

        const isDeletable = type !== 'my-devices' && (item.id !== currentUserId);
        const deleteButton = isDeletable ? `<button data-id="${item.id}" data-type="${type === 'school-users' ? 'users' : type === 'school-devices' ? 'devices' : type}" class="delete-btn text-red-600 hover:text-red-900 transition-colors">Delete</button>` : '';
        
        return `
            <tr class="hover:bg-gray-50">
                ${cellsHtml}
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    ${deleteButton}
                </td>
            </tr>
        `;
    });
    
    return Promise.all(promises).then(resolvedRows => {
        rowsHtml = resolvedRows.join('');
        return `
            <div class="overflow-x-auto rounded-lg shadow-md">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            ${tableHeaderHtml}
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    });
}

// --- Rendering Functions ---
async function renderSystemUsers(users, adminId) {
    const usersWithoutAdmin = users.filter(u => u.id !== adminId);
    userList.innerHTML = await createTableHTML(usersWithoutAdmin, 'users', adminId);
    setupListeners();
}

async function renderSystemSchools(schools) {
    schoolList.innerHTML = await createTableHTML(schools, 'schools', null);
    setupListeners();
}

async function renderSystemDevices(devices) {
    deviceList.innerHTML = await createTableHTML(devices, 'devices', null);
    setupListeners();
}

async function renderSchoolUsers(users, schoolAdminId) {
    const usersWithoutAdmin = users.filter(u => u.id !== schoolAdminId);
    schoolUserList.innerHTML = await createTableHTML(usersWithoutAdmin, 'school-users', schoolAdminId);
    setupListeners();
}

async function renderSchoolDevices(devices) {
    schoolDeviceList.innerHTML = await createTableHTML(devices, 'school-devices', null);
    setupListeners();
}

async function renderMyDevices(devices) {
    myDeviceList.innerHTML = await createTableHTML(devices, 'my-devices', auth.currentUser.uid);
    setupListeners();
}

// --- Dashboard Setup Functions ---
function setupSystemAdminDashboard(adminId) {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSystemUsers(users, adminId);
    });

    onSnapshot(collection(db, "devices"), (snapshot) => {
        const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSystemDevices(devices);
    });
    
    onSnapshot(collection(db, "schools"), (snapshot) => {
        const schools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSystemSchools(schools);
    });
}
 
function setupSchoolAdminDashboard(schoolAdminId, schoolId, userData) {
    schoolAdminTitle.textContent = `${userData.schoolName} Admin Dashboard`;
    deviceFormLink.textContent = `${window.location.origin}${window.location.pathname}?schoolId=${schoolId}`;
    
    const usersQuery = query(collection(db, "users"), where("schoolId", "==", schoolId));
    onSnapshot(usersQuery, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSchoolUsers(users, schoolAdminId);
    });
    
    const devicesQuery = query(collection(db, "devices"), where("schoolId", "==", schoolId));
    onSnapshot(devicesQuery, (snapshot) => {
        const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSchoolDevices(devices);
    });
}

function setupUserDashboard(currentUserId, userData) {
    userEmailDisplay.textContent = `Email: ${userData.email}`;
    userRoleDisplay.textContent = `Role: ${userData.role}`;
    
    if (userData.schoolId) {
        onSnapshot(doc(db, "schools", userData.schoolId), (schoolDoc) => {
            if (schoolDoc.exists()) {
                userSchoolDisplay.textContent = `School: ${schoolDoc.data().name}`;
            } else {
                userSchoolDisplay.textContent = `School: N/A`;
            }
        });
    } else {
        userSchoolDisplay.textContent = `School: N/A`;
    }

    const devicesQuery = query(collection(db, "devices"), where("ownerId", "==", currentUserId));
    onSnapshot(devicesQuery, (snapshot) => {
        const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMyDevices(devices);
    });
}

function setupPublicDeviceForm(schoolId) {
    publicDeviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);
        publicFormMessage.textContent = '';
        publicFormMessage.classList.remove('text-red-500');
        
        try {
            const deviceName = publicDeviceNameInput.value;
            const userEmail = publicUserEmailInput.value;
            
            const usersQuery = query(collection(db, "users"), where("email", "==", userEmail));
            const usersSnapshot = await getDocs(usersQuery);
            let userDocRef;
            let existingUser = null;
            
            if (!usersSnapshot.empty) {
                userDocRef = usersSnapshot.docs[0].ref;
                existingUser = usersSnapshot.docs[0].data();
            } else {
                const anonUserDocRef = doc(collection(db, "users"));
                await setDoc(anonUserDocRef, {
                    email: userEmail,
                    role: 'user',
                    schoolId: schoolId,
                    associatedDeviceIds: []
                });
                userDocRef = anonUserDocRef;
                existingUser = { associatedDeviceIds: [] };
            }
            
            const newDeviceRef = await addDoc(collection(db, "devices"), {
                name: deviceName,
                status: 'online',
                ownerId: userDocRef.id,
                schoolId: schoolId
            });
            
            const newDeviceIds = [...(existingUser.associatedDeviceIds || []), newDeviceRef.id];
            await updateDoc(userDocRef, {
                associatedDeviceIds: newDeviceIds
            });
            
            publicFormMessage.textContent = `Device "${deviceName}" successfully registered!`;
            publicFormMessage.classList.add('text-green-500');
            publicDeviceForm.reset();
            
        } catch (error) {
            console.error("Device registration error:", error);
            publicFormMessage.textContent = "An error occurred during registration. Please try again.";
            publicFormMessage.classList.add('text-red-500');
        } finally {
            showLoading(false);
        }
    });
}

// --- Initialization ---
window.onload = async function() {
    showLoading(true);
    try {
        const params = getQueryParams();
        if (params.schoolId) {
            const schoolDoc = await getDoc(doc(db, "schools", params.schoolId));
            if (schoolDoc.exists()) {
                publicFormTitle.textContent = `Device Registration for ${schoolDoc.data().name}`;
                setupPublicDeviceForm(params.schoolId);
                showView('public-device-form-view');
                showLoading(false);
                return;
            } else {
                publicFormMessage.textContent = "Invalid school link.";
                showView('public-device-form-view');
                showLoading(false);
                return;
            }
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.role === 'admin') {
                        setupSystemAdminDashboard(user.uid);
                        showView('admin-dashboard');
                    } else if (userData.role === 'school-admin') {
                        const schoolDoc = await getDoc(doc(db, "schools", userData.schoolId));
                        userData.schoolName = schoolDoc.exists() ? schoolDoc.data().name : 'Unknown School';
                        setupSchoolAdminDashboard(user.uid, userData.schoolId, userData);
                        showView('school-admin-dashboard');
                    } else {
                        setupUserDashboard(user.uid, userData);
                        showView('user-dashboard');
                    }
                } else {
                    showView('login-register-view');
                    authMessage.textContent = "Welcome! Please register your account.";
                }
            } else {
                showView('login-register-view');
            }
            showLoading(false);
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        authMessage.textContent = "An error occurred. Please try again.";
        showLoading(false);
    }
};

// --- Event Listeners for Authentication and Modals ---
toggleAuthBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Log In' : 'Register';
    authButton.textContent = isLogin ? 'Log In' : 'Register';
    toggleAuthBtn.textContent = isLogin ? "Don't have an account? Register" : "Already have an account? Log In";
    authMessage.textContent = '';
});

registerSchoolBtn.addEventListener('click', () => {
    schoolModal.classList.remove('hidden');
});

closeSchoolModalBtn.addEventListener('click', () => {
    schoolModal.classList.add('hidden');
    schoolForm.reset();
    schoolFormMessage.textContent = '';
});

goHomeBtn.addEventListener('click', () => {
    window.location.href = window.location.origin + window.location.pathname;
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    authMessage.textContent = '';
    showLoading(true);
    
    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: 'user',
                schoolId: null,
                associatedDeviceIds: []
            });
        }
    } catch (error) {
        console.error("Authentication error:", error);
        authMessage.textContent = error.message;
    } finally {
        showLoading(false);
    }
});

schoolForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    schoolFormMessage.textContent = '';
    showLoading(true);
    try {
        const schoolName = schoolNameInput.value;
        const email = schoolAdminEmailInput.value;
        const password = schoolAdminPasswordInput.value;
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const newSchoolRef = await addDoc(collection(db, "schools"), {
            name: schoolName,
            adminUserId: user.uid
        });
        
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: 'school-admin',
            schoolId: newSchoolRef.id,
            associatedDeviceIds: []
        });
        
        schoolModal.classList.add('hidden');
    } catch (error) {
        console.error("School registration error:", error);
        schoolFormMessage.textContent = error.message;
    } finally {
        showLoading(false);
    }
});

adminLogoutBtn.addEventListener('click', () => signOut(auth));
schoolAdminLogoutBtn.addEventListener('click', () => signOut(auth));
userLogoutBtn.addEventListener('click', () => signOut(auth));
