import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, addDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- IMPORTANT: REPLACE WITH YOUR FIREBASE CONFIG ---
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
const schoolSelectContainer = document.getElementById('school-select-container');
const schoolSelect = document.getElementById('school-select');

const adminLogoutBtn = document.getElementById('admin-logout-btn');
const schoolAdminLogoutBtn = document.getElementById('school-admin-logout-btn');
const userLogoutBtn = document.getElementById('user-logout-btn');

const schoolList = document.getElementById('school-list');
const userList = document.getElementById('user-list');
const deviceList = document.getElementById('device-list');
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

const editModal = document.getElementById('edit-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const editForm = document.getElementById('edit-form');
const editModalTitle = document.getElementById('edit-modal-title');
const editFields = document.getElementById('edit-fields');
const editFormMessage = document.getElementById('edit-form-message');

const schoolSearchInput = document.getElementById('school-search');
const userSearchInput = document.getElementById('user-search');
const deviceSearchInput = document.getElementById('device-search');
const schoolUserSearchInput = document.getElementById('school-user-search');
const schoolDeviceSearchInput = document.getElementById('school-device-search');
const myDeviceSearchInput = document.getElementById('my-device-search');

// --- Global State ---
let allSchools = [];
let allUsers = [];
let allDevices = [];
let schoolMap = {};
let isLogin = true;
let currentUserData = null;

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

// --- Dynamic Table and Modal Logic ---
function setupListeners(userRole) {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            if (confirm(`Are you sure you want to delete this ${type}?`)) {
                await deleteItem(id, type);
            }
        });
    });

    if (userRole === 'admin' || userRole === 'school-admin') {
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                await openEditModal(id, type);
            });
        });
    }

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

async function deleteItem(id, type) {
    showLoading(true);
    try {
        const batch = writeBatch(db);
        
        if (type === 'schools') {
            const schoolRef = doc(db, "schools", id);
            const usersQuery = query(collection(db, "users"), where("schoolId", "==", id));
            const devicesQuery = query(collection(db, "devices"), where("schoolId", "==", id));
            const [usersSnapshot, devicesSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(devicesQuery)]);
            
            usersSnapshot.forEach(userDoc => batch.delete(userDoc.ref));
            devicesSnapshot.forEach(deviceDoc => batch.delete(deviceDoc.ref));
            batch.delete(schoolRef);

        } else if (type === 'users' || type === 'school-users') {
            const userRef = doc(db, "users", id);
            const devicesQuery = query(collection(db, "devices"), where("ownerId", "==", id));
            const devicesSnapshot = await getDocs(devicesQuery);
            devicesSnapshot.forEach(deviceDoc => batch.delete(deviceDoc.ref));
            batch.delete(userRef);

        } else if (type === 'devices' || type === 'school-devices' || type === 'my-devices') {
            const deviceRef = doc(db, "devices", id);
            batch.delete(deviceRef);
        }
        
        await batch.commit();
        alert("Item successfully deleted.");
    } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete. Please try again.");
    } finally {
        showLoading(false);
    }
}

async function openEditModal(id, type) {
    editFormMessage.textContent = '';
    editForm.dataset.id = id;
    editForm.dataset.type = type;
    editFields.innerHTML = '';
    
    let itemData;
    let fieldsHtml = '';

    switch(type) {
        case 'schools':
            itemData = allSchools.find(s => s.id === id);
            editModalTitle.textContent = 'Edit School';
            fieldsHtml = `
                <div>
                    <label for="edit-school-name" class="block text-sm font-medium text-gray-700">School Name</label>
                    <input type="text" id="edit-school-name" value="${itemData.name}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md" required>
                </div>
            `;
            break;
        case 'users':
        case 'school-users':
            itemData = allUsers.find(u => u.id === id);
            editModalTitle.textContent = 'Edit User';
            fieldsHtml = `
                <div>
                    <label for="edit-user-email" class="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" id="edit-user-email" value="${itemData.email}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md" required>
                </div>
                <div>
                    <label for="edit-user-role" class="block text-sm font-medium text-gray-700">Role</label>
                    <select id="edit-user-role" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="user" ${itemData.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="school-admin" ${itemData.role === 'school-admin' ? 'selected' : ''}>School Admin</option>
                        <option value="admin" ${itemData.role === 'admin' ? 'selected' : ''}>System Admin</option>
                    </select>
                </div>
            `;
            break;
        case 'devices':
        case 'school-devices':
        case 'my-devices':
            itemData = allDevices.find(d => d.id === id);
            editModalTitle.textContent = 'Edit Device';
            fieldsHtml = `
                <div>
                    <label for="edit-device-name" class="block text-sm font-medium text-gray-700">Device Name</label>
                    <input type="text" id="edit-device-name" value="${itemData.name}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md" required>
                </div>
                <div>
                    <label for="edit-device-status" class="block text-sm font-medium text-gray-700">Status</label>
                    <select id="edit-device-status" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                        <option value="online" ${itemData.status === 'online' ? 'selected' : ''}>Online</option>
                        <option value="offline" ${itemData.status === 'offline' ? 'selected' : ''}>Offline</option>
                    </select>
                </div>
            `;
            break;
    }

    editFields.innerHTML = fieldsHtml;
    editModal.classList.remove('hidden');
}

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    editFormMessage.textContent = '';
    const id = editForm.dataset.id;
    const type = editForm.dataset.type;

    try {
        if (type === 'schools') {
            const name = document.getElementById('edit-school-name').value;
            await updateDoc(doc(db, 'schools', id), { name });
        } else if (type.includes('user')) {
            const email = document.getElementById('edit-user-email').value;
            const role = document.getElementById('edit-user-role').value;
            await updateDoc(doc(db, 'users', id), { email, role });
        } else if (type.includes('device')) {
            const name = document.getElementById('edit-device-name').value;
            const status = document.getElementById('edit-device-status').value;
            await updateDoc(doc(db, 'devices', id), { name, status });
        }
        editModal.classList.add('hidden');
        alert("Changes saved successfully.");
    } catch (error) {
        console.error("Error saving changes:", error);
        editFormMessage.textContent = "Failed to save changes. " + error.message;
    } finally {
        showLoading(false);
    }
});

closeEditModalBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
    editForm.reset();
});

function createTableHTML(data, type, currentUserId, userRole, searchTerm) {
    if (!data || data.length === 0) {
        return `<p class="text-gray-500">No ${type} found.</p>`;
    }
    
    let headers;
    let getRowData;
    let filteredData = data;
    const isSearchable = searchTerm && searchTerm.trim() !== '';

    switch (type) {
        case 'users':
        case 'school-users':
            headers = ['Email', 'Role', 'School'];
            getRowData = async (item) => {
                const schoolName = item.schoolId ? schoolMap[item.schoolId] || 'N/A' : 'N/A';
                return [item.email, item.role.replace('-', ' '), schoolName];
            };
            if (isSearchable) {
                filteredData = data.filter(item => item.email.toLowerCase().includes(searchTerm.toLowerCase()));
            }
            break;
        case 'schools':
            headers = ['Name', 'Admin Email'];
            getRowData = async (item) => {
                const adminUser = allUsers.find(u => u.id === item.adminUserId);
                return [item.name, adminUser ? adminUser.email : 'N/A'];
            };
            if (isSearchable) {
                filteredData = data.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
            }
            break;
        case 'devices':
        case 'school-devices':
        case 'my-devices':
            headers = ['Name', 'Owner Email', 'Status'];
            if (type === 'my-devices') headers = ['Name', 'Status'];
            getRowData = async (item) => {
                const ownerUser = allUsers.find(u => u.id === item.ownerId);
                const ownerEmail = ownerUser ? ownerUser.email : 'N/A';
                return type === 'my-devices' ? [item.name, item.status] : [item.name, ownerEmail, item.status];
            };
            if (isSearchable) {
                filteredData = data.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
            }
            break;
        default:
            return '';
    }

    const tableHeaderHtml = headers.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`).join('');
    
    let rowsHtml = '';
    
    const promises = filteredData.map(async (item) => {
        const rowData = await getRowData(item);
        const cellsHtml = rowData.map(cell => {
            const isStatus = cell === 'online' || cell === 'offline';
            const statusColor = isStatus ? (cell === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : '';
            return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><span class="py-1 px-3 text-xs font-semibold rounded-full ${statusColor}">${isStatus ? cell : cell}</span></td>`;
        }).join('');

        const isDeletable = type !== 'my-devices' && item.id !== currentUserId;
        const deleteButton = isDeletable ? `<button data-id="${item.id}" data-type="${type}" class="delete-btn text-red-600 hover:text-red-900 transition-colors">Delete</button>` : '';
        
        const isEditable = (userRole === 'admin' || userRole === 'school-admin') && type !== 'my-devices';
        const editButton = isEditable ? `<button data-id="${item.id}" data-type="${type}" class="edit-btn text-blue-600 hover:text-blue-900 transition-colors ml-4">Edit</button>` : '';

        return `
            <tr class="hover:bg-gray-50">
                ${cellsHtml}
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    ${editButton}
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

function renderContent() {
    schoolMap = allSchools.reduce((map, school) => {
        map[school.id] = school.name;
        return map;
    }, {});
    
    if (currentUserData) {
        const userRole = currentUserData.role;
        const currentUserId = auth.currentUser.uid;
        const schoolId = currentUserData.schoolId;

        if (userRole === 'admin') {
            const searchTerm = schoolSearchInput.value;
            createTableHTML(allSchools, 'schools', currentUserId, userRole, searchTerm).then(html => {
                schoolList.innerHTML = html;
                setupListeners(userRole);
            });
            const userSearchTerm = userSearchInput.value;
            const usersWithoutAdmin = allUsers.filter(u => u.id !== currentUserId);
            createTableHTML(usersWithoutAdmin, 'users', currentUserId, userRole, userSearchTerm).then(html => {
                userList.innerHTML = html;
                setupListeners(userRole);
            });
            const deviceSearchTerm = deviceSearchInput.value;
            createTableHTML(allDevices, 'devices', currentUserId, userRole, deviceSearchTerm).then(html => {
                deviceList.innerHTML = html;
                setupListeners(userRole);
            });
        } else if (userRole === 'school-admin') {
            const schoolUsers = allUsers.filter(u => u.schoolId === schoolId);
            const usersWithoutAdmin = schoolUsers.filter(u => u.id !== currentUserId);
            const userSearchTerm = schoolUserSearchInput.value;
            createTableHTML(usersWithoutAdmin, 'school-users', currentUserId, userRole, userSearchTerm).then(html => {
                schoolUserList.innerHTML = html;
                setupListeners(userRole);
            });
            const schoolDevices = allDevices.filter(d => d.schoolId === schoolId);
            const deviceSearchTerm = schoolDeviceSearchInput.value;
            createTableHTML(schoolDevices, 'school-devices', currentUserId, userRole, deviceSearchTerm).then(html => {
                schoolDeviceList.innerHTML = html;
                setupListeners(userRole);
            });
        } else {
            const myDevices = allDevices.filter(d => d.ownerId === currentUserId);
            const deviceSearchTerm = myDeviceSearchInput.value;
            createTableHTML(myDevices, 'my-devices', currentUserId, userRole, deviceSearchTerm).then(html => {
                myDeviceList.innerHTML = html;
                setupListeners(userRole);
            });
        }
    }
}

// --- Dashboard Setup Functions ---
function setupSystemAdminDashboard(userId) {
    showView('admin-dashboard');
    schoolSearchInput.addEventListener('input', renderContent);
    userSearchInput.addEventListener('input', renderContent);
    deviceSearchInput.addEventListener('input', renderContent);
    onSnapshot(collection(db, "schools"), (snapshot) => {
        allSchools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
    });
    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
    });
    onSnapshot(collection(db, "devices"), (snapshot) => {
        allDevices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
    });
}
 
function setupSchoolAdminDashboard(schoolId) {
    schoolAdminTitle.textContent = `${currentUserData.schoolName} Admin Dashboard`;
    deviceFormLink.textContent = `${window.location.origin}${window.location.pathname}?schoolId=${schoolId}`;
    showView('school-admin-dashboard');
    schoolUserSearchInput.addEventListener('input', renderContent);
    schoolDeviceSearchInput.addEventListener('input', renderContent);

    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
    });
    onSnapshot(collection(db, "devices"), (snapshot) => {
        allDevices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
    });
}

function setupUserDashboard(userId) {
    userEmailDisplay.textContent = `Email: ${currentUserData.email}`;
    userRoleDisplay.textContent = `Role: ${currentUserData.role}`;
    userSchoolDisplay.textContent = `School: ${currentUserData.schoolName || 'N/A'}`;
    showView('user-dashboard');
    myDeviceSearchInput.addEventListener('input', renderContent);

    onSnapshot(collection(db, "devices"), (snapshot) => {
        allDevices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderContent();
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

// Function to populate the school selection dropdown
async function populateSchoolSelect() {
    schoolSelect.innerHTML = '<option value="">No School</option>';
    try {
        const schoolsSnapshot = await getDocs(collection(db, "schools"));
        schoolsSnapshot.forEach(doc => {
            const school = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = school.name;
            schoolSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching schools:", error);
    }
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
            } else {
                publicFormMessage.textContent = "Invalid school link.";
                showView('public-device-form-view');
            }
            showLoading(false);
            return;
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    currentUserData = userDoc.data();
                    if (currentUserData.role === 'admin') {
                        setupSystemAdminDashboard(user.uid);
                    } else if (currentUserData.role === 'school-admin') {
                        const schoolDoc = await getDoc(doc(db, "schools", currentUserData.schoolId));
                        currentUserData.schoolName = schoolDoc.exists() ? schoolDoc.data().name : 'Unknown School';
                        setupSchoolAdminDashboard(currentUserData.schoolId);
                    } else {
                        if (currentUserData.schoolId) {
                            const schoolDoc = await getDoc(doc(db, "schools", currentUserData.schoolId));
                            currentUserData.schoolName = schoolDoc.exists() ? schoolDoc.data().name : 'Unknown School';
                        }
                        setupUserDashboard(user.uid);
                    }
                } else {
                    showView('login-register-view');
                    authMessage.textContent = "Welcome! Please register your account.";
                }
            } else {
                currentUserData = null;
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
toggleAuthBtn.addEventListener('click', async () => {
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Log In' : 'Register';
    authButton.textContent = isLogin ? 'Log In' : 'Register';
    toggleAuthBtn.textContent = isLogin ? "Don't have an account? Register" : "Already have an account? Log In";
    authMessage.textContent = '';
    schoolSelectContainer.classList.toggle('hidden', isLogin);

    // If switching to register, fetch and populate schools
    if (!isLogin) {
        await populateSchoolSelect();
    }
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
            const schoolId = schoolSelect.value || null;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: 'user',
                schoolId: schoolId,
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
