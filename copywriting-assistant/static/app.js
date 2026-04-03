/**
 * Copy Chief - Copywriting Assistant Frontend
 * Handles chat UI, file uploads, streaming responses, and session management.
 */

(function () {
    "use strict";

    // --- State ---
    const state = {
        sessionId: crypto.randomUUID(),
        isStreaming: false,
        uploadedFiles: [],       // Files loaded into context (sidebar)
        pendingAttachments: [],  // Files attached to next message
    };

    // --- DOM refs ---
    const $ = (sel) => document.querySelector(sel);
    const messagesEl = $("#messages");
    const messagesContainer = $("#messagesContainer");
    const messageInput = $("#messageInput");
    const btnSend = $("#btnSend");
    const btnNewChat = $("#btnNewChat");
    const btnExport = $("#btnExport");
    const btnToggleSidebar = $("#btnToggleSidebar");
    const sidebar = $("#sidebar");
    const uploadArea = $("#uploadArea");
    const fileInput = $("#fileInput");
    const fileInputChat = $("#fileInputChat");
    const fileList = $("#fileList");
    const inputAttachments = $("#inputAttachments");
    const welcomeScreen = $("#welcomeScreen");

    // --- Markdown setup ---
    if (typeof marked !== "undefined") {
        marked.setOptions({
            breaks: true,
            gfm: true,
        });
    }

    function renderMarkdown(text) {
        if (typeof marked !== "undefined") {
            return marked.parse(text);
        }
        return text.replace(/\n/g, "<br>");
    }

    // --- Helpers ---
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function setStreaming(val) {
        state.isStreaming = val;
        btnSend.disabled = val || !messageInput.value.trim();
        messageInput.disabled = val;
        if (!val) messageInput.focus();
    }

    function hideWelcome() {
        if (welcomeScreen) welcomeScreen.style.display = "none";
    }

    // --- Messages ---
    function addMessage(role, content) {
        hideWelcome();
        const msg = document.createElement("div");
        msg.className = `message ${role}`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = role === "user" ? "Y" : "C";

        const contentWrap = document.createElement("div");
        contentWrap.className = "message-content";

        const roleLabel = document.createElement("div");
        roleLabel.className = "message-role";
        roleLabel.textContent = role === "user" ? "You" : "Copy Chief";

        const body = document.createElement("div");
        body.className = "message-body";

        if (role === "user") {
            body.textContent = content;
        } else {
            body.innerHTML = renderMarkdown(content);
        }

        contentWrap.appendChild(roleLabel);
        contentWrap.appendChild(body);
        msg.appendChild(avatar);
        msg.appendChild(contentWrap);
        messagesEl.appendChild(msg);
        scrollToBottom();

        return body;
    }

    function addStreamingMessage() {
        hideWelcome();
        const msg = document.createElement("div");
        msg.className = "message assistant";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "C";

        const contentWrap = document.createElement("div");
        contentWrap.className = "message-content";

        const roleLabel = document.createElement("div");
        roleLabel.className = "message-role";
        roleLabel.textContent = "Copy Chief";

        const body = document.createElement("div");
        body.className = "message-body";

        const typing = document.createElement("div");
        typing.className = "typing-indicator";
        typing.innerHTML = "<span></span><span></span><span></span>";
        body.appendChild(typing);

        contentWrap.appendChild(roleLabel);
        contentWrap.appendChild(body);
        msg.appendChild(avatar);
        msg.appendChild(contentWrap);
        messagesEl.appendChild(msg);
        scrollToBottom();

        return body;
    }

    function showError(text) {
        const errDiv = document.createElement("div");
        errDiv.className = "error-message";
        errDiv.textContent = text;
        messagesEl.appendChild(errDiv);
        scrollToBottom();
    }

    // --- Streaming Chat ---
    async function sendMessage(text) {
        if (!text.trim() || state.isStreaming) return;

        // Prepend attached file contents
        let fullMessage = "";
        if (state.pendingAttachments.length > 0) {
            const fileParts = state.pendingAttachments
                .map((f) => `[File: ${f.name}]\n${f.content}`)
                .join("\n\n---\n\n");
            fullMessage = `Here is data from my files:\n\n${fileParts}\n\n---\n\nMy message: ${text}`;
            state.pendingAttachments = [];
            renderPendingAttachments();
        } else {
            fullMessage = text;
        }

        addMessage("user", text);
        messageInput.value = "";
        autoResize();
        setStreaming(true);

        const body = addStreamingMessage();
        let accumulated = "";

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: state.sessionId,
                    message: fullMessage,
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        if (event.type === "text") {
                            accumulated += event.content;
                            body.innerHTML = renderMarkdown(accumulated);
                            scrollToBottom();
                        } else if (event.type === "error") {
                            showError(event.content);
                        }
                    } catch {
                        // skip parse errors in stream
                    }
                }
            }
        } catch (err) {
            showError("Connection error. Please check the server is running.");
        }

        setStreaming(false);
    }

    // --- File Handling ---
    async function uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.error) {
                showError(data.error);
                return null;
            }
            return data;
        } catch {
            showError("Failed to upload file.");
            return null;
        }
    }

    function renderFileList() {
        fileList.innerHTML = "";
        state.uploadedFiles.forEach((f, idx) => {
            const li = document.createElement("li");
            li.className = "file-item";
            li.innerHTML = `
                <span class="file-item-name">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M8 1H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5L8 1z" stroke="currentColor" stroke-width="1.2"/>
                        <path d="M8 1v4h4" stroke="currentColor" stroke-width="1.2"/>
                    </svg>
                    ${f.filename}
                </span>
                <button class="file-item-remove" data-idx="${idx}" title="Remove file">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            `;
            fileList.appendChild(li);
        });

        fileList.querySelectorAll(".file-item-remove").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.idx);
                state.uploadedFiles.splice(idx, 1);
                renderFileList();
            });
        });
    }

    function renderPendingAttachments() {
        inputAttachments.innerHTML = "";
        state.pendingAttachments.forEach((f, idx) => {
            const chip = document.createElement("span");
            chip.className = "input-attachment-chip";
            chip.innerHTML = `${f.name} <button data-idx="${idx}">&times;</button>`;
            inputAttachments.appendChild(chip);
        });

        inputAttachments.querySelectorAll("button").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.idx);
                state.pendingAttachments.splice(idx, 1);
                renderPendingAttachments();
            });
        });
    }

    async function handleSidebarFiles(files) {
        for (const file of files) {
            const result = await uploadFile(file);
            if (result) {
                state.uploadedFiles.push(result);
                // Also add to pending attachments for next message
                state.pendingAttachments.push({
                    name: result.filename,
                    content: result.content,
                });
            }
        }
        renderFileList();
        renderPendingAttachments();
    }

    async function handleChatFiles(files) {
        for (const file of files) {
            const result = await uploadFile(file);
            if (result) {
                state.pendingAttachments.push({
                    name: result.filename,
                    content: result.content,
                });
            }
        }
        renderPendingAttachments();
    }

    // --- Auto-resize textarea ---
    function autoResize() {
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
        btnSend.disabled = state.isStreaming || !messageInput.value.trim();
    }

    // --- New chat ---
    async function startNewChat() {
        state.sessionId = crypto.randomUUID();
        state.uploadedFiles = [];
        state.pendingAttachments = [];

        // Clear on server
        await fetch("/api/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: state.sessionId }),
        });

        messagesEl.innerHTML = "";
        if (welcomeScreen) {
            messagesEl.appendChild(welcomeScreen);
            welcomeScreen.style.display = "";
        }
        renderFileList();
        renderPendingAttachments();
        messageInput.value = "";
        autoResize();
    }

    // --- Export ---
    async function exportConversation() {
        try {
            const res = await fetch("/api/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: state.sessionId }),
            });
            const data = await res.json();

            if (!data.conversation) {
                showError("No conversation to export.");
                return;
            }

            const blob = new Blob([data.conversation], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `copy-chief-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            showError("Failed to export conversation.");
        }
    }

    // --- Event Listeners ---

    // Send on button click
    btnSend.addEventListener("click", () => sendMessage(messageInput.value));

    // Send on Enter (Shift+Enter for newline)
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    // Auto resize
    messageInput.addEventListener("input", autoResize);

    // New chat
    btnNewChat.addEventListener("click", startNewChat);

    // Export
    btnExport.addEventListener("click", exportConversation);

    // Toggle sidebar
    btnToggleSidebar.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // Sidebar file upload
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) handleSidebarFiles(e.target.files);
        e.target.value = "";
    });

    // Chat file attach
    fileInputChat.addEventListener("change", (e) => {
        if (e.target.files.length) handleChatFiles(e.target.files);
        e.target.value = "";
    });

    // Drag & drop on upload area
    uploadArea.addEventListener("click", () => fileInput.click());

    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        if (e.dataTransfer.files.length) handleSidebarFiles(e.dataTransfer.files);
    });

    // Quick action buttons
    document.querySelectorAll(".btn-action").forEach((btn) => {
        btn.addEventListener("click", () => {
            messageInput.value = btn.dataset.prompt;
            autoResize();
            messageInput.focus();
        });
    });

    // Welcome cards
    document.querySelectorAll(".welcome-card").forEach((card) => {
        card.addEventListener("click", () => {
            messageInput.value = card.dataset.prompt;
            autoResize();
            messageInput.focus();
        });
    });

    // Initial focus
    messageInput.focus();
})();
