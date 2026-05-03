(function () {
	const DEFAULT_CONFIG = {
    businessId: "967c5b1f-1376-4272-8be3-af82f65128db",
    apiUrl: "https://ai-autopilot-backend-togt.onrender.com",
};
	const state = {
		config: null,
		isOpen: false,
		isInitialized: false,
		isMounted: false,
		messageCount: 0,
	};

	function ensureSlash(url) {
		return url.replace(/\/$/, "");
	}

	function createElement(tag, styles, attributes) {
		const element = document.createElement(tag);
		if (styles) {
			Object.assign(element.style, styles);
		}
		if (attributes) {
			Object.keys(attributes).forEach((key) => {
				element.setAttribute(key, attributes[key]);
			});
		}
		return element;
	}

	function createChatBubble(text, role) {
		const wrapper = createElement("div", {
			display: "flex",
			justifyContent: role === "user" ? "flex-end" : "flex-start",
			marginBottom: "10px",
		});

		const bubble = createElement("div", {
			maxWidth: "80%",
			padding: "10px 12px",
			borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
			fontSize: "14px",
			lineHeight: "1.45",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			backgroundColor: role === "user" ? "#2563eb" : "#f3f7ff",
			color: role === "user" ? "#ffffff" : "#1f2937",
			border: role === "user" ? "1px solid #1d4ed8" : "1px solid #dbe7ff",
			boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
		});

		bubble.textContent = text;
		wrapper.appendChild(bubble);
		return wrapper;
	}

	function scrollMessagesToBottom(messagesEl) {
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function showTypingIndicator(messagesEl) {
		const typing = createElement("div", {
			display: "flex",
			justifyContent: "flex-start",
			marginBottom: "10px",
		});

		const bubble = createElement("div", {
			padding: "10px 12px",
			borderRadius: "16px 16px 16px 4px",
			fontSize: "14px",
			color: "#4b5563",
			backgroundColor: "#f8fafc",
			border: "1px solid #e5e7eb",
			boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
		});

		bubble.textContent = "Typing...";
		typing.dataset.typing = "true";
		typing.appendChild(bubble);
		messagesEl.appendChild(typing);
		scrollMessagesToBottom(messagesEl);
		return typing;
	}

	function parseReply(responseData) {
		if (!responseData) {
			return "Sorry, I couldn't generate a reply right now.";
		}

		if (typeof responseData === "string") {
			return responseData;
		}

		return responseData.reply || responseData.message || responseData.text || "Sorry, I couldn't generate a reply right now.";
	}

	async function sendMessage(inputEl, messagesEl, config) {
		const message = inputEl.value.trim();
		if (!message) {
			return;
		}

		inputEl.value = "";
		messagesEl.appendChild(createChatBubble(message, "user"));
		scrollMessagesToBottom(messagesEl);

		const typingNode = showTypingIndicator(messagesEl);
		inputEl.disabled = true;

		try {
			const response = await fetch(`${ensureSlash(config.apiUrl)}/chat`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					business_id: config.businessId,
					message,
				}),
			});

			const data = await response.json().catch(() => ({}));
			const reply = parseReply(data);
			typingNode.remove();
			messagesEl.appendChild(createChatBubble(reply, "assistant"));
		} catch (error) {
			typingNode.remove();
			messagesEl.appendChild(
				createChatBubble(
					"Sorry, we couldn't reach the assistant right now. Please try again in a moment.",
					"assistant"
				)
			);
			console.error("AutopilotWidget chat error:", error);
		} finally {
			inputEl.disabled = false;
			inputEl.focus();
			scrollMessagesToBottom(messagesEl);
		}
	}

	function buildIcon() {
		const iconWrapper = createElement("div", {
			width: "28px",
			height: "28px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		});
		iconWrapper.innerHTML =
			'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.8337 20 9.71996 19.7918 8.70084 19.4126L4.5 20.5L5.60375 16.5824C4.62172 15.2501 4 13.4706 4 11.5C4 6.80558 7.85786 3 12.5 3C17.1421 3 21 6.80558 21 11.5Z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 11.5H15.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 8.5H13.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 14.5H12.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>';
		return iconWrapper;
	}

	function mountWidget(config) {
		if (state.isMounted) {
			return;
		}

		state.isMounted = true;

		const safeConfig = {
			businessId: config.businessId || DEFAULT_CONFIG.businessId,
			apiUrl: config.apiUrl || DEFAULT_CONFIG.apiUrl,
		};
		state.config = safeConfig;

		const container = createElement("div", {
			position: "fixed",
			right: "20px",
			bottom: "20px",
			zIndex: "2147483647",
			fontFamily:
				'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		});

		const panel = createElement("div", {
			position: "absolute",
			right: "0",
			bottom: "72px",
			width: "360px",
			maxWidth: "calc(100vw - 40px)",
			height: "480px",
			backgroundColor: "#ffffff",
			borderRadius: "20px",
			boxShadow: "0 20px 50px rgba(15, 23, 42, 0.22)",
			border: "1px solid #dbe7ff",
			overflow: "hidden",
			display: "none",
			flexDirection: "column",
		});

		const header = createElement("div", {
			padding: "16px 18px",
			background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
			color: "#ffffff",
			fontSize: "16px",
			fontWeight: "700",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
		});
		header.textContent = "Chat with us";

		const messages = createElement("div", {
			flex: "1",
			padding: "16px",
			overflowY: "auto",
			backgroundColor: "#f8fbff",
		});

		const starter = createChatBubble("Hi! How can we help you today?", "assistant");
		messages.appendChild(starter);

		const composer = createElement("div", {
			padding: "12px",
			borderTop: "1px solid #e5eefc",
			backgroundColor: "#ffffff",
			display: "flex",
			gap: "10px",
			alignItems: "center",
		});

		const input = createElement("input", {
			flex: "1",
			height: "42px",
			padding: "0 14px",
			borderRadius: "12px",
			border: "1px solid #c7d7ef",
			outline: "none",
			fontSize: "14px",
			color: "#0f172a",
			backgroundColor: "#ffffff",
			boxSizing: "border-box",
		});
		input.type = "text";
		input.placeholder = "Type your message...";

		const sendButton = createElement("button", {
			height: "42px",
			minWidth: "84px",
			padding: "0 16px",
			border: "none",
			borderRadius: "12px",
			backgroundColor: "#2563eb",
			color: "#ffffff",
			fontSize: "14px",
			fontWeight: "700",
			cursor: "pointer",
			boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)",
		});
		sendButton.textContent = "Send";

		sendButton.addEventListener("mouseenter", function () {
			if (!sendButton.disabled) {
				sendButton.style.backgroundColor = "#1d4ed8";
			}
		});
		sendButton.addEventListener("mouseleave", function () {
			if (!sendButton.disabled) {
				sendButton.style.backgroundColor = "#2563eb";
			}
		});

		const button = createElement("button", {
			width: "64px",
			height: "64px",
			borderRadius: "999px",
			border: "none",
			backgroundColor: "#2563eb",
			color: "#ffffff",
			cursor: "pointer",
			boxShadow: "0 14px 30px rgba(37, 99, 235, 0.35)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
		});
		button.setAttribute("aria-label", "Open chat widget");
		button.appendChild(buildIcon());

		button.addEventListener("mouseenter", function () {
			button.style.transform = "translateY(-2px)";
			button.style.boxShadow = "0 18px 36px rgba(37, 99, 235, 0.42)";
		});
		button.addEventListener("mouseleave", function () {
			button.style.transform = "translateY(0)";
			button.style.boxShadow = "0 14px 30px rgba(37, 99, 235, 0.35)";
		});

		async function handleSend() {
			await sendMessage(input, messages, safeConfig);
		}

		sendButton.addEventListener("click", handleSend);
		input.addEventListener("keydown", function (event) {
			if (event.key === "Enter") {
				event.preventDefault();
				handleSend();
			}
		});

		button.addEventListener("click", function () {
			state.isOpen = !state.isOpen;
			panel.style.display = state.isOpen ? "flex" : "none";
			if (state.isOpen) {
				input.focus();
			}
		});

		composer.appendChild(input);
		composer.appendChild(sendButton);
		panel.appendChild(header);
		panel.appendChild(messages);
		panel.appendChild(composer);
		container.appendChild(panel);
		container.appendChild(button);
		document.body.appendChild(container);
	}

	function init(config) {
		if (state.isInitialized) {
			return;
		}

		state.isInitialized = true;
		const finalConfig = Object.assign({}, DEFAULT_CONFIG, config || {});

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", function onReady() {
				document.removeEventListener("DOMContentLoaded", onReady);
				mountWidget(finalConfig);
			});
			return;
		}

		mountWidget(finalConfig);
	}

	window.AutopilotWidget = {
		init: init,
	};

	window.AutopilotWidget.init({
    businessId: "967c5b1f-1376-4272-8be3-af82f65128db",
    apiUrl: "https://ai-autopilot-backend-togt.onrender.com",
});
})();
