const passwordWrappers = document.querySelectorAll(".input-wrapper.password");

passwordWrappers.forEach((wrapper) => {
	const passwordInput = wrapper.querySelector("input");

	const visibilityToggle = document.createElement("button");
	visibilityToggle.type = "button";
	visibilityToggle.classList.add(
		"material-symbols-outlined",
		"visibility-toggle",
	);
	visibilityToggle.textContent = "visibility_off";

	visibilityToggle.addEventListener("click", () => {
		visibilityToggle.classList.toggle("visible");
		passwordInput.focus();

		if (visibilityToggle.classList.contains("visible")) {
			passwordInput.type = "text";
			visibilityToggle.textContent = "visibility";
		} else {
			passwordInput.type = "password";
			visibilityToggle.textContent = "visibility_off";
		}
	});

	wrapper.appendChild(visibilityToggle);
});

const inputWrappers = document.querySelectorAll(".input-err-wrapper");

inputWrappers.forEach((wrapper) => {
	const errorMsg = wrapper.querySelector(".error-msg");
	const inputField = wrapper.querySelector("input");

	if (errorMsg.textContent != "") {
		inputField.addEventListener("input", () => {
			errorMsg.textContent = "";
			errorMsg.classList.remove("active");
		});

		errorMsg.classList.add("active");
	}
});

function setupModal(backdropSelector) {
	const backdrop = document.querySelector(backdropSelector);
	if (!backdrop) return null;

	const form = backdrop.querySelector("form");
	const cancelBtn = backdrop.querySelector(".cancel-btn");
	const primaryInput = backdrop.querySelector("input[type='text']");

	backdrop.addEventListener("click", (e) => {
		e.stopPropagation();
		if (form && !form.contains(e.target)) {
			close();
		}
	});

	cancelBtn?.addEventListener("click", () => {
		close();
	});

	function open() {
		backdrop.classList.add("active");
		if (primaryInput) {
			primaryInput.focus();
		}
	}

	function close() {
		backdrop.classList.remove("active");
		if (form) form.reset();
	}

	return { open, close, backdrop, form };
}

export const renameModal = setupModal(".form-modal.rename-item");

const createFolderModal = setupModal(".form-modal.add-folder");

document.querySelector(".new-folder-btn")?.addEventListener("click", () => {
	createFolderModal?.open();
});
