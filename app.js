// --- 1. إعدادات Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHwGPkWSkqD_AgSt9Zq7qiud1vU5FYy7I",
    authDomain: "snake-game-b6197.firebaseapp.com",
    projectId: "snake-game-b6197",
    storageBucket: "snake-game-b6197.firebasestorage.app",
    messagingSenderId: "666304258198",
    appId: "1:666304258198:web:c55c1e79b05ef53aaca2b7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// --- 2. متغيرات اللعبة و UI ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [];
let velocity = { x: 1, y: 0 };
let food = { x: 10, y: 10 };
let bonusFood = null;
let score = 0;
let currentSpeed = 130; 
let changingDirection = false;
let isPaused = false;
let regularFoodEaten = 0;
let gameLoopId;
let currentPlayerEmail = "لاعب مجهول";
let isGuest = false;
let currentPlayerName = "زائر";

// الشاشات والأزرار الجديدة
const homeScreen = document.getElementById("home-screen");
const authScreen = document.getElementById("auth-screen");
const gameScreen = document.getElementById("game-screen");
const gameOverScreen = document.getElementById("game-over-screen");

const authToggleBtn = document.getElementById("auth-toggle-btn");
const playBtn = document.getElementById("play-btn");
const pauseBtn = document.getElementById("pause-btn");
const pauseOverlay = document.getElementById("pause-overlay");
const resumeBtn = document.getElementById("resume-btn");
const authMsg = document.getElementById("auth-msg");

// تحميل قائمة المتصدرين في البداية

// --- 3. نظام الحسابات (Authentication) ---

// زر الدخول / الخروج الموحد في الصفحة الرئيسية
authToggleBtn.addEventListener("click", () => {
    if (auth.currentUser) {
        signOut(auth).catch((error) => console.error(error));
    } else {
        homeScreen.classList.add("hidden");
        authScreen.classList.remove("hidden");
    }
});
// تشغيل زر الرجوع في شاشة تسجيل الدخول
const backArrowBtn = document.getElementById("back-arrow-btn");

backArrowBtn.addEventListener("click", () => {
    // إخفاء شاشة التسجيل وإظهار الشاشة الرئيسية
    authScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    
    // مسح أي رسالة خطأ سابقة
    const authMsg = document.getElementById("auth-msg");
    if(authMsg) authMsg.textContent = ""; 
});

// التبديل بين شاشة الدخول والتسجيل
document.getElementById("show-signup-btn").addEventListener("click", () => {
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("signup-section").classList.remove("hidden");
    authMsg.textContent = "";
});

document.getElementById("show-login-btn").addEventListener("click", () => {
    document.getElementById("signup-section").classList.add("hidden");
    document.getElementById("login-section").classList.remove("hidden");
    authMsg.textContent = "";
});

// مراقبة حالة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user) {
        isGuest = false;
        currentPlayerName = user.displayName || user.email.split('@')[0]; 
        
        document.getElementById("user-email-display").textContent = currentPlayerName;
        document.getElementById("welcome-msg").classList.remove("hidden");
        authToggleBtn.textContent = "تسجيل الخروج";
        
        authScreen.classList.add("hidden");
        gameScreen.classList.add("hidden");
        gameOverScreen.classList.add("hidden");
        homeScreen.classList.remove("hidden");
        fetchLeaderboard();
    } else {
        isGuest = true;
        currentPlayerName = "زائر";
        
        document.getElementById("welcome-msg").classList.add("hidden");
        authToggleBtn.textContent = "تسجيل الدخول";
        
        authScreen.classList.add("hidden");
        gameScreen.classList.add("hidden");
        gameOverScreen.classList.add("hidden");
        homeScreen.classList.remove("hidden");
        document.getElementById("top-scores-list").innerHTML = "<li style='text-align:center; color:#aaa;'>سجل دخول لرؤية المتصدرين</li>";
        // ملاحظة: لو مش عايز أي كلام يظهر خالص، استبدل السطر اللي فوق بـ:
        // document.getElementById("top-scores-list").innerHTML = "";
    }
});

// تسجيل الدخول
document.getElementById("login-btn").addEventListener("click", () => {
    const email = document.getElementById("email-login").value;
    const password = document.getElementById("password-login").value;
    signInWithEmailAndPassword(auth, email, password)
        .then(() => { authMsg.textContent = ""; })
        .catch(() => { authMsg.textContent = "خطأ في الإيميل أو الباسورد!"; });
});

// إنشاء حساب
document.getElementById("signup-btn").addEventListener("click", () => {
    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("email-signup").value;
    const password = document.getElementById("password-signup").value;

    if (!firstName || !lastName) {
        authMsg.textContent = "الرجاء إدخال الاسم الأول والأخير!";
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            return updateProfile(userCredential.user, {
                displayName: firstName + " " + lastName
            });
        })
        .then(() => { authMsg.textContent = ""; })
        .catch(() => { authMsg.textContent = "خطأ: تأكد من قوة الباسورد وأن الإيميل غير مستخدم مسبقاً."; });
});

// نسيان الباسورد
document.getElementById("forgot-password-btn").addEventListener("click", () => {
    const email = document.getElementById("email-login").value;
    if(!email) {
        authMsg.textContent = "اكتب الإيميل في خانة الدخول أولاً لإرسال الرابط!";
        return;
    }
    sendPasswordResetEmail(auth, email)
        .then(() => { authMsg.textContent = "تم إرسال رابط استعادة الباسورد للإيميل!"; authMsg.style.color = "#00ff88"; })
        .catch(() => { authMsg.textContent = "حدث خطأ، تأكد من الإيميل!"; });
});


// --- 4. منطق اللعبة ---

// بدء اللعب من الصفحة الرئيسية المباشرة
playBtn.addEventListener("click", () => {
    homeScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    resetGame();
});

document.getElementById("restart-btn").addEventListener("click", () => {
    gameOverScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    resetGame();
});

document.getElementById("back-home-btn").addEventListener("click", () => {
    gameOverScreen.classList.add("hidden");
    homeScreen.classList.remove("hidden");
    
    // تحديث القائمة فقط إذا لم يكن زعيراً
    if (!isGuest) {
        fetchLeaderboard();
    }
});
function resetGame() {
    snake = [{ x: 10, y: 10 }];
    velocity = { x: 1, y: 0 };
    score = 0;
    regularFoodEaten = 0;
    bonusFood = null;
    document.getElementById("score").textContent = score;
    placeFood();
    currentSpeed = 130; 
    if (gameLoopId) clearInterval(gameLoopId);
    gameLoopId = setInterval(gameLoop, currentSpeed);
    isPaused = false;
    pauseOverlay.classList.add("hidden");
    pauseBtn.textContent = "⏸️ إيقاف"; 
}

function gameLoop() {
    if (isPaused) return; // إذا كانت متوقفة، لا تكمل الكود
    update();
    draw();
}

function update() {
    changingDirection = false; // <--- أضف هذا السطر هنا
    if (velocity.x === 0 && velocity.y === 0) return;
    let head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            handleGameOver();
            return;
        }
    }

    snake.unshift(head);

    // 1. أكل الطعام العادي
    if (head.x === food.x && head.y === food.y) {
        score++;
        regularFoodEaten++;
        document.getElementById("score").textContent = score;
        placeFood();

        // ظهور البونص
        if (regularFoodEaten % 5 === 0) {
            placeBonusFood();
        }

        // زيادة السرعة
        if (regularFoodEaten % 3 === 0 && currentSpeed > 70) { 
            currentSpeed -= 4; 
            clearInterval(gameLoopId);
            gameLoopId = setInterval(gameLoop, currentSpeed);
        }
    } 
    // 2. أكل طعام البونص
    else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
        score += 3;
        document.getElementById("score").textContent = score;
        bonusFood = null;
        snake.push({...snake[snake.length - 1]});
        snake.push({...snake[snake.length - 1]});
    } 
    // 3. حذف الذيل لو الثعبان مأكلش
    else {
        snake.pop(); 
    }
}

function draw() {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let foodCenterX = food.x * gridSize + gridSize / 2;
    let foodCenterY = food.y * gridSize + gridSize / 2;
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, gridSize / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(foodCenterX - 3, foodCenterY - 3, 3, 0, 2 * Math.PI);
    ctx.fill();

    if (bonusFood) {
        let bonusX = bonusFood.x * gridSize + gridSize / 2;
        let bonusY = bonusFood.y * gridSize + gridSize / 2;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ffd700";
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(bonusX, bonusY, gridSize / 2 - 1, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0; 
    }

    for (let i = 0; i < snake.length; i++) {
        let x = snake[i].x * gridSize + gridSize / 2;
        let y = snake[i].y * gridSize + gridSize / 2;
        let radius = gridSize / 2 - 1; 

        if (i === 0) {
            ctx.fillStyle = "#00b3b3"; 
            ctx.beginPath();
            ctx.arc(x, y, radius + 2, 0, 2 * Math.PI); 
            ctx.fill();

            ctx.fillStyle = "white";
            let eyeRadius = 3;
            let pupilRadius = 1.5;
            let offset1 = { x: 0, y: 0 };
            let offset2 = { x: 0, y: 0 };

            if (velocity.x === 1) { 
                offset1 = { x: 4, y: -4 }; offset2 = { x: 4, y: 4 };
            } else if (velocity.x === -1) { 
                offset1 = { x: -4, y: -4 }; offset2 = { x: -4, y: 4 };
            } else if (velocity.y === -1) { 
                offset1 = { x: -4, y: -4 }; offset2 = { x: 4, y: -4 };
            } else if (velocity.y === 1) { 
                offset1 = { x: -4, y: 4 }; offset2 = { x: 4, y: 4 };
            } else { 
                offset1 = { x: 4, y: -4 }; offset2 = { x: 4, y: 4 };
            }

            ctx.beginPath(); ctx.arc(x + offset1.x, y + offset1.y, eyeRadius, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset2.x, y + offset2.y, eyeRadius, 0, 2 * Math.PI); ctx.fill();

            ctx.fillStyle = "black";
            ctx.beginPath(); ctx.arc(x + offset1.x + (velocity.x * 1), y + offset1.y + (velocity.y * 1), pupilRadius, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset2.x + (velocity.x * 1), y + offset2.y + (velocity.y * 1), pupilRadius, 0, 2 * Math.PI); ctx.fill();

        } else {
            ctx.fillStyle = "#00b3b3"; 
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; 
            ctx.beginPath();
            ctx.arc(x, y, radius / 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function placeFood() {
    let onSnake = true;
    while (onSnake) {
        food = { 
            x: Math.floor(Math.random() * tileCount), 
            y: Math.floor(Math.random() * tileCount) 
        };
        onSnake = snake.some(segment => segment.x === food.x && segment.y === food.y);
    }
}

function placeBonusFood() {
    bonusFood = { x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) };
    setTimeout(() => { bonusFood = null; }, 7000); 
}
// دالة تشغيل وإيقاف اللعبة
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        pauseOverlay.classList.remove("hidden");
        pauseBtn.textContent = "▶️ استئناف";
    } else {
        pauseOverlay.classList.add("hidden");
        pauseBtn.textContent = "⏸️ إيقاف";
    }
}

// تشغيل الدالة عند الضغط على الأزرار
pauseBtn.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", togglePause);

// إضافة التحكم بالكيبورد (زر المسطرة أو حرف P)
document.addEventListener("keydown", (e) => {
    // التحقق من أن شاشة اللعبة هي المفتوحة حالياً لتجنب إيقاف اللعبة قبل أن تبدأ
    if (!gameScreen.classList.contains("hidden") && gameOverScreen.classList.contains("hidden")) {
        if (e.key === "p" || e.key === "P" || e.key === " ") {
            e.preventDefault(); // لمنع المسطرة من عمل سكرول للصفحة
            togglePause();
        }
    }
    
    // ... (كود الأسهم القديم الخاص بك يظل كما هو هنا) ...
    if(isPaused) return; // منع تحريك الثعبان أثناء الإيقاف
    switch (e.key) {
        case "ArrowUp": case "w": case "W": if (velocity.y !== 1) velocity = { x: 0, y: -1 }; break;
        case "ArrowDown": case "s": case "S": if (velocity.y !== -1) velocity = { x: 0, y: 1 }; break;
        case "ArrowLeft": case "a": case "A": if (velocity.x !== 1) velocity = { x: -1, y: 0 }; break;
        case "ArrowRight": case "d": case "D": if (velocity.x !== -1) velocity = { x: 1, y: 0 }; break;
    }
});


// --- 5. حفظ البيانات وقائمة الـ Top 10 ---
async function handleGameOver() {
    clearInterval(gameLoopId);
    gameScreen.classList.add("hidden");
    gameOverScreen.classList.remove("hidden");
    document.getElementById("final-score").textContent = score;

    if (score > 0 && !isGuest) {
        try {
            const user = auth.currentUser;
            const playerRef = doc(db, "snake_scores", user.uid);
            const playerSnap = await getDoc(playerRef);

            if (!playerSnap.exists()) {
                await setDoc(playerRef, {
                    name: currentPlayerName,
                    score: score,
                    date: new Date().toISOString()
                });
            } else {
                const oldScore = playerSnap.data().score;
                if (score > oldScore) {
                    await setDoc(playerRef, {
                        name: currentPlayerName,
                        score: score,
                        date: new Date().toISOString()
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

async function fetchLeaderboard() {
    const listElement = document.getElementById("top-scores-list");
    listElement.innerHTML = "<li>جاري التحميل...</li>";

    try {
        const q = query(collection(db, "snake_scores"), orderBy("score", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        listElement.innerHTML = "";
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement("li");
            li.innerHTML = `<span>#${rank} ${data.name}</span> <span>${data.score} نقطة</span>`;
            listElement.appendChild(li);
            rank++;
        });
    } catch (e) {
        console.error("Error fetching leaderboard: ", e);
        listElement.innerHTML = "<li>حدث خطأ في جلب النتائج</li>";
    }
}
// --- 6. نظام التحكم للموبايل (Swipe Controls) ---
let touchStartX = 0;
let touchStartY = 0;

// تسجيل مكان لمس الشاشة لأول مرة
canvas.addEventListener("touchstart", function(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    
    // منع حركة الشاشة الافتراضية إذا كانت اللعبة شغالة
    if (!isPaused) {
        e.preventDefault(); 
    }
}, { passive: false });

// منع السكرول أثناء السحب
canvas.addEventListener("touchmove", function(e) {
    if (!isPaused) {
        e.preventDefault();
    }
}, { passive: false });

// تحديد الاتجاه عند رفع الأصبع من على الشاشة
canvas.addEventListener("touchend", function(e) {
    if (isPaused) return; // لا تفعل شيئاً إذا كانت اللعبة متوقفة

    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;

    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
});

function handleSwipe(startX, startY, endX, endY) {
    if (changingDirection) return; // منع تغيير الاتجاه مرتين في نفس اللحظة

    let diffX = endX - startX;
    let diffY = endY - startY;

    // قللنا الرقم من 30 لـ 15 عشان اللمس يكون حساس وسريع جداً
    if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // سحب أفقي (يمين أو يسار)
        if (diffX > 0 && velocity.x !== -1) { 
            velocity = { x: 1, y: 0 }; changingDirection = true;
        } else if (diffX < 0 && velocity.x !== 1) { 
            velocity = { x: -1, y: 0 }; changingDirection = true;
        }
    } else {
        // سحب عمودي (فوق أو تحت)
        if (diffY > 0 && velocity.y !== -1) { 
            velocity = { x: 0, y: 1 }; changingDirection = true;
        } else if (diffY < 0 && velocity.y !== 1) { 
            velocity = { x: 0, y: -1 }; changingDirection = true;
        }
    }
}