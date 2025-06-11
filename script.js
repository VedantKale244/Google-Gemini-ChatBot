const container = document.querySelector(".main-container");
const chatsContainer = document.querySelector(".chatbox-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// Array of suggestions
const suggestionsList = [
    { text: "Design a home office setup for remote work under $500.", icon: "draw" },
    { text: "Suggest some useful tools for debugging JavaScript.", icon: "explore" },
    { text: "Give me a roadmap to be a good software developer.", icon: "lightbulb" },
    { text: "How can I level up my web development expertise?", icon: "code_blocks" },
    { text: "What are the best practices for writing clean code?", icon: "code" },
    { text: "Explain the concept of microservices architecture.", icon: "architecture" },
    { text: "What are the latest trends in AI and machine learning?", icon: "psychology" },
    { text: "How to optimize website performance?", icon: "speed" },
    { text: "Best practices for database design.", icon: "database" },
    { text: "How to implement secure authentication?", icon: "security" }
];

// Function to get random suggestions
function getRandomSuggestions(count = 4) {
    const shuffled = [...suggestionsList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Function to update suggestions
function updateSuggestions() {
    const suggestionBox = document.querySelector('.suggestion-boxes');
    suggestionBox.innerHTML = '';
    
    getRandomSuggestions().forEach(suggestion => {
        const li = document.createElement('li');
        li.className = 'suggestions';
        li.innerHTML = `
            <p class="text">${suggestion.text}</p>
            <span class="material-symbols-rounded">${suggestion.icon}</span>
        `;
        suggestionBox.appendChild(li);
        
        // Add click event listener
        li.addEventListener('click', () => {
            promptInput.value = suggestion.text;
            promptForm.dispatchEvent(new Event('submit'));
        });
    });
}
// Update suggestions when page loads
document.addEventListener('DOMContentLoaded', updateSuggestions);

const API_KEY = config.API_KEY;
const API_URL = ` https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`

let typingInterval, controller;
const chatHistory = [];
const userData = { message: "", file: {}};

// function to create message elements
const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("msg", ...classes);
    div.innerHTML = content;
    return div;
}

// Debounce function to limit scroll updates
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized scroll to bottom function
const scrollToBottom = debounce(() => {
    const scrollOptions = {
        top: container.scrollHeight,
        behavior: "smooth"
    };
    
    // Only scroll if we're already near the bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
        container.scrollTo(scrollOptions);
    }
}, 100);

// simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
    textElement.textContent = "";
    const words = text.split(" ");
    let wordIndex = 0;
    let lastScrollTime = 0;
    const SCROLL_INTERVAL = 100; // Minimum time between scrolls in milliseconds

    // set an interval to type each word
    typingInterval = setInterval(() => {
        if(wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : " ")  + words[wordIndex++]; 
            
            // Only scroll if enough time has passed since last scroll
            const now = Date.now();
            if (now - lastScrollTime >= SCROLL_INTERVAL) {
                scrollToBottom();
                lastScrollTime = now;
            }
        } else {
            clearInterval(typingInterval);
            botMsgDiv.classList.remove("loading"); 
            document.body.classList.remove("bot-responding");
            // Final scroll after typing is complete
            scrollToBottom();
            // Show message actions after typing is complete
            botMsgDiv.querySelector('.message-actions').classList.add('active');
        }
    }, 40);
}

// ... rest of your script.js code ...


const generateResponse = async (botMsgDiv, userMessage) => {
    const textElement = botMsgDiv.querySelector(".text-message");
    controller = new AbortController();

    chatHistory.push({
        role: "user",
        parts: [{ text: userMessage }, ...(userData.file.data ? [{ inline_data: (({fileName, isImage, ...rest}) => rest) (userData.file)}] : [])]
    });

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ contents : chatHistory}),
            signal : controller.signal
        }); 

        const data = await response.json();
        if(!response.ok) throw new Error(data.error.message);

        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
        typingEffect(responseText, textElement, botMsgDiv);
        chatHistory.push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
      textElement.style.color = "#d62939";
      textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
    } finally {
       userData.file = {};
    }
}
const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = promptInput.value.trim();
    if(!userMessage || document.body.classList.contains("bot-responding")) return;
    
    promptInput.value = "";
    userData.message = userMessage;
    document.body.classList.add("bot-responding", "chats-active");
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    // Generate user msg HTML and add in the chats container
    const userMsgHTML = `
    <p class="text-message"></p>
    ${userData.file.data ? ( userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
          : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
  `;
    
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
    userMsgDiv.querySelector(".text-message").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();
    
    setTimeout(() =>{
        // Generate bot msg HTML and add in the chats container after 600ms
        const botMsgHTML = `<img src="./gemini-chatbot-logo.svg" alt="" class="avatar"><p class="text-message">Just a sec...</p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        scrollToBottom(); 
        generateResponse(botMsgDiv, userMessage);
    }, 60);
}

// handle file input change (file uploading)
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if(!file) return;

    const isImage = file.type.startsWith("image/")
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

        userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
    }
});

// cancel the upload file
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
});

document.querySelector("#stop-response").addEventListener("click", () => {
    userData.file = {};
    controller?.abort();
    clearInterval(typingInterval);
    chatsContainer.querySelector(".bot-message.loading").classList.remove("loading"); 
     document.body.classList.remove("bot-responding");
});

document.querySelector("#delete-chat").addEventListener("click", () => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
});

document.querySelectorAll(".suggestions").forEach(item =>{
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#attach-file-btn").addEventListener("click", () => fileInput.click());


document.addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") ||
        (wrapper.classList.contains("hide-controls") &&
            (target.id === "attach-file-btn" || target.id === "stop-response"));
    wrapper.classList.toggle("hide-controls", shouldHide);
});