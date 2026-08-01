import {
	moveItemModal,
	renameModal,
	detailsModal,
	trashModal,
	deleteModal,
	shareModal,
} from "./modals.js";

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
	openBtn?.addEventListener("click", handleOpen);

	// Rename
	const renameBtn = dropdown.querySelector("button.rename-item");

	renameBtn?.addEventListener("click", () => {
		renameModal.form.action = `/rename-${itemType}`;

		renameModal.form.querySelector("#itemId").value = itemId;
		renameModal.form.querySelector("#name").value = itemName;

		renameModal.open();
	});

	// Move
	const moveBtn = dropdown.querySelector("button.move-item");
	moveBtn?.addEventListener("click", () => {
		moveItemModal.form.action = `/move-${itemType}`;
		moveItemModal?.open(itemId);
	});

	// Details
	const detailsBtn = dropdown.querySelector("button.item-details");
	detailsBtn?.addEventListener("click", async () => {
		const isFolder = itemType === "folder";

		let dataPoint = `/${itemType}-details/${itemId}`;

		const response = await fetch(dataPoint);
		const data = await response.json();
		const details = data.details;

		const modalTitle = detailsModal.firstChild.querySelector(".title");
		modalTitle.textContent = isFolder ? "Folder Details" : "File Details";
		const nameField = detailsModal.firstChild.querySelector(".name-value");
		nameField.textContent = details.name;
		const typeField = detailsModal.firstChild.querySelector(".type-value");
		typeField.textContent = details.type;
		const sizeField = detailsModal.firstChild.querySelector(".size-value");
		sizeField.textContent = details.size + " MB";
		const locationField =
			detailsModal.firstChild.querySelector(".location-value");
		locationField.textContent = details.location;
		const ownerField = detailsModal.firstChild.querySelector(".owner-value");
		ownerField.textContent = details.owner;
		const timeLabel = detailsModal.firstChild.querySelector(".time-lable");
		timeLabel.textContent = isFolder ? "Created" : "Uploaded";
		const timeField = detailsModal.firstChild.querySelector(".time-value");
		timeField.textContent = details.time;

		detailsModal?.open();
	});

	// Delete

	const deleteBtn = dropdown.querySelector("button.delete-item");
	deleteBtn?.addEventListener("click", async () => {
		deleteModal.form.action = `/delete-${itemType}`;
		deleteModal.form.querySelector("#itemId").value = itemId;
		deleteModal.form.querySelector(".item-name").textContent = `'${itemName}'`;

		deleteModal?.open();
	});

	async function openShareModal(itemId, itemType) {
		shareModal.form.action = `/share-${itemType}`;
		shareModal.form.querySelector("#itemId").value = itemId;
		shareModal.form.querySelector(".title").textContent = `Share ${itemType}`;

		const response = await fetch(`/${itemType}-sharing-details/${itemId}`);
		const data = await response.json();
		const sharingDetails = data.sharingDetails;

		if (sharingDetails) {
			const accessTypeSelect = shareModal.form.querySelector("select#access");
			accessTypeSelect.value = sharingDetails.access;
			accessTypeSelect.dispatchEvent(new Event("change"));

			if (!sharingDetails.isExpired && sharingDetails.access === "PUBLIC") {
				const timerWrapper = shareModal.form.querySelector(".timer-wrapper");

				const timerHeader = shareModal.form.querySelector(
					".timer-header-wrapper .header",
				);

				const timerEditBtn = shareModal.form.querySelector(".edit-timer-btn");

				const timerInputs = shareModal.form.querySelectorAll(".timer input");

				const enableTimer = () => {
					timerWrapper.classList.remove("disabled");

					timerHeader.textContent = "Edit timer";

					timerEditBtn.classList.remove("active");

					timerInputs.forEach((input) => {
						input.disabled = false;
					});
				};

				const disableTimer = () => {
					timerWrapper.classList.add("disabled");

					timerHeader.textContent = "Remaining time";

					timerEditBtn.classList.add("active");

					timerInputs.forEach((input) => {
						input.disabled = true;
					});
				};

				const durationTypeSelect =
					shareModal.form.querySelector("select#duration");

				durationTypeSelect.value = sharingDetails.expiresAt
					? "timed"
					: "forever";
				durationTypeSelect.dispatchEvent(new Event("change"));

				if (sharingDetails.expiresAt) {
					shareModal.form.querySelector("input#days").value =
						sharingDetails.remainingTime.days;
					shareModal.form.querySelector("input#hours").value =
						sharingDetails.remainingTime.hours;
					shareModal.form.querySelector("input#minutes").value =
						sharingDetails.remainingTime.minutes;

					disableTimer();

					timerEditBtn.onclick = enableTimer;
				}

				shareModal.form.querySelector(".link-wrapper").classList.add("active");

				shareModal.form.querySelector("input#link").value = sharingDetails.link;

				shareModal.form.querySelector("button.submit-btn").textContent =
					"Update";
			}
		}

		shareModal?.open();

		shareModal?.form.querySelector("input#link").blur();
	}

	const shareBtn = dropdown.querySelector("button.share-item");
	shareBtn?.addEventListener("click", () => {
		openShareModal(itemId, itemType);
	});

	shareModal?.form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const form = e.target;
		const payload = {
			itemId: itemId,
			access: form.access.value,
			duration: form.duration.value,
			days: form.days.value,
			hours: form.hours.value,
			minutes: form.minutes.value,
		};

		const response = await fetch(`share-${itemType}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			await openShareModal(itemId, itemType);
		}
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
