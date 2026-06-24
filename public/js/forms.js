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
		});
	}
});
