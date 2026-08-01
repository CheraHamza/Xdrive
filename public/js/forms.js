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

const shareForm = document.querySelector(".share-item-form");

const accessTypeSelect = shareForm?.querySelector("select#access");

const accessIcon = shareForm?.querySelector(".access-icon");

const durationWrapper = shareForm?.querySelector(".duration-wrapper");

const durationSelect = shareForm?.querySelector("select#duration");

const timerWrapper = shareForm?.querySelector(".timer-wrapper");

const linkWrapper = shareForm?.querySelector(".link-wrapper");

const linkField = shareForm?.querySelector("input#link");

const copyLinkBtn = shareForm?.querySelector("button.copyBtn");

accessTypeSelect?.addEventListener("change", (e) => {
	let accessType = e.target.value;

	if (accessType === "RESTRICTED") {
		accessIcon.textContent = "lock";

		durationWrapper.classList.remove("active");
		durationSelect.value = "forever";
		durationSelect.dispatchEvent(new Event("change"));
		linkWrapper.classList.remove("active");
	} else {
		accessIcon.textContent = "public";
		durationWrapper.classList.add("active");
	}
});

durationSelect?.addEventListener("change", (e) => {
	let duration = e.target.value;

	if (duration === "forever") {
		timerWrapper.classList.remove("active");
	} else {
		timerWrapper.classList.add("active");
	}
});

copyLinkBtn?.addEventListener("click", async () => {
	await navigator.clipboard.writeText(linkField?.value);
});

const daysField = shareForm?.querySelector("input#days");
const hoursField = shareForm?.querySelector("input#hours");
const minutesField = shareForm?.querySelector("input#minutes");

const daysUp = shareForm?.querySelector("button.days-up");
const daysDown = shareForm?.querySelector("button.days-down");

const hoursUp = shareForm?.querySelector("button.hours-up");
const hoursDown = shareForm?.querySelector("button.hours-down");

const minutesUp = shareForm?.querySelector("button.minutes-up");
const minutesDown = shareForm?.querySelector("button.minutes-down");

function setupNumberSpinner(input, upBtn, downBtn, min = 0, max = Infinity) {
	if (!input || !upBtn || !downBtn) return;

	input.addEventListener("input", () => {
		let val = parseInt(input.value, 10);
		if (val > max) input.value = max;
		if (val < min) input.value = min;
	});

	upBtn.addEventListener("click", (e) => {
		e.preventDefault();
		const currentVal = parseInt(input.value, 10) || 0;
		if (currentVal < max) input.value = currentVal + 1;
	});

	downBtn.addEventListener("click", (e) => {
		e.preventDefault();
		const currentVal = parseInt(input.value, 10) || 0;
		if (currentVal > min) input.value = currentVal - 1;
	});
}

setupNumberSpinner(daysField, daysUp, daysDown, 0);
setupNumberSpinner(hoursField, hoursUp, hoursDown, 0, 23);
setupNumberSpinner(minutesField, minutesUp, minutesDown, 0, 59);
