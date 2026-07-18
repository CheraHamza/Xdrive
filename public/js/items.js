import { moveItemModal, renameModal } from "./forms.js";

const itemElements = document.querySelectorAll(".item");

// handle drop down menu

itemElements.forEach((item) => {
	const menuBtn = item.querySelector(".item-menu-btn");
	const dropdown = item.querySelector(".item-dropdown");

	if (!menuBtn || !dropdown) return;

	menuBtn.addEventListener("dblclick", (e) => {
		e.stopPropagation();
	});

	menuBtn.addEventListener("click", (e) => {
		e.stopPropagation();

		itemElements.forEach((otherItem) => {
			if (otherItem !== item) {
				const otherDropdown = otherItem.querySelector(".item-dropdown");
				if (otherDropdown) otherDropdown.classList.remove("active");
			}
		});

		const isOpening = !dropdown.classList.contains("active");
		dropdown.classList.toggle("active");

		if (isOpening) {
			dropdown.style.left = "";
			dropdown.style.right = "";
			dropdown.style.top = "";
			dropdown.style.bottom = "";

			const rect = dropdown.getBoundingClientRect();
			const windowWidth = window.innerWidth;
			const windowHight = window.innerHeight;

			if (rect.right > windowWidth) {
				dropdown.style.right = "25px";
			} else {
				dropdown.style.left = "25px";
			}

			if (rect.bottom > windowHight) {
				dropdown.style.bottom = "25px";
			} else {
				dropdown.style.top = "25px ";
			}
		}
	});
});

document.addEventListener("click", () => {
	itemElements.forEach((item) => {
		const dropdown = item.querySelector(".item-dropdown");
		dropdown.classList.remove("active");
	});
});

// item interactions

itemElements.forEach((item) => {
	const dropdown = item.querySelector(".item-dropdown");

	const itemId = item.id;
	const itemName = item.getAttribute("data-name");
	const itemType = item.getAttribute("data-type");

	// Open
	const handleOpen = () => {
		if (itemType == "folder") {
			window.location.href = `/folder/${itemId}`;
		} else {
			const fileURL = item.getAttribute("data-url");
			if (fileURL) window.open(fileURL, "_blank");
		}
	};

	item.addEventListener("dblclick", handleOpen);

	const openBtn = dropdown.querySelector("button.open-item");
	openBtn.addEventListener("click", handleOpen);

	// Rename
	const renameBtn = dropdown.querySelector("button.rename-item");

	renameBtn.addEventListener("click", () => {
		renameModal.form.action = `/rename-${itemType}`;

		renameModal.form.querySelector("#itemId").value = itemId;
		renameModal.form.querySelector("#name").value = itemName;

		renameModal.open();
	});

	// Move
	const moveBtn = dropdown.querySelector("button.move-item");
	moveBtn.addEventListener("click", (e) => {
		moveItemModal.form.action = `/move-${itemType}`;
		moveItemModal?.open(itemId);
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
