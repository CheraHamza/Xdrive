const fileElements = document.querySelectorAll(".file");

// handle drop down menu

fileElements.forEach((file) => {
	const fileMenuBtn = file.querySelector(".file-menu-btn");
	const fileDropdown = file.querySelector(".file-dropdown");

	fileMenuBtn.addEventListener("dblclick", (e) => {
		e.stopPropagation();
	});

	fileMenuBtn.addEventListener("click", (e) => {
		e.stopPropagation();

		fileElements.forEach((otherFile) => {
			if (otherFile !== file) {
				const otherDropdown = otherFile.querySelector(".file-dropdown");
				otherDropdown.classList.remove("active");
			}
		});

		const isOpening = !fileDropdown.classList.contains("active");
		fileDropdown.classList.toggle("active");

		if (isOpening) {
			fileDropdown.style.left = "";
			fileDropdown.style.right = "";

			const rect = fileDropdown.getBoundingClientRect();
			const windowWidth = window.innerWidth;

			if (rect.right > windowWidth) {
				fileDropdown.style.right = "25px";
			} else {
				fileDropdown.style.left = "25px";
			}
		}
	});
});

document.addEventListener("click", () => {
	fileElements.forEach((file) => {
		const fileDropdown = file.querySelector(".file-dropdown");
		fileDropdown.classList.remove("active");
	});
});

// handle file / dropdown functionalities and logic

fileElements.forEach((file) => {
	const fileDropdown = file.querySelector(".file-dropdown");

	const fileId = file.id;
	const fileURL = file.getAttribute("data-url");
	const fileName = file.getAttribute("data-name");

	// open file

	// double click
	file.addEventListener("dblclick", (e) => {
		if (fileURL) {
			window.open(fileURL, "_blank");
		}
	});
	// open through menu
	const openFileBtn = fileDropdown.querySelector("button.open-file");
	openFileBtn.addEventListener("click", () => {
		if (fileURL) {
			window.open(fileURL, "_blank");
		}
	});

	// rename file

	const renameFileBtn = fileDropdown.querySelector("button.rename-file");
	const fullViewForm = document.querySelector(".full-view-form.rename-file");
	const renameForm = fullViewForm.querySelector("form");
	const idField = renameForm.querySelector("input#fileID");
	const nameField = renameForm.querySelector("input#filename");

	renameFileBtn.addEventListener("click", () => {
		fullViewForm.classList.toggle("active");

		if (fullViewForm.classList.contains("active")) {
			idField.value = fileId;
			nameField.value = fileName;
			nameField.focus();
		}
	});

	fullViewForm.addEventListener("click", (e) => {
		e.stopPropagation();

		if (!renameForm.contains(e.target)) {
			fullViewForm.classList.remove("active");
		}
	});

	const cancelBtn = renameForm.querySelector(".cancel-btn");

	cancelBtn.addEventListener("click", () => {
		idField.value = "";
		nameField.value = "";
		fullViewForm.classList.remove("active");
	});
});

// Freeze Gifs

document.addEventListener("DOMContentLoaded", () => {
	const gifImages = document.querySelectorAll(".gif-thumbnail");

	gifImages.forEach((img) => {
		if (img.complete) {
			freezeGif(img);
		} else {
			img.addEventListener("load", () => freezeGif(img));
		}
	});

	function freezeGif(img) {
		if (img.src.startsWith("data:image")) {
			return;
		}
		try {
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;

			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			const staticDataUrl = canvas.toDataURL("image/png");
			img.src = staticDataUrl;
		} catch (error) {
			console.error("Failed to freeze GIF thumbnail:", error);
		}
	}
});
