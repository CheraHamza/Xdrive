import {
	moveItemModal,
	renameModal,
	detailsModal,
	deleteModal,
	shareModal,
	setShareModalView,
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

		const modalTitle =
			detailsModal.immediateChildren[0].querySelector(".title");
		modalTitle.textContent = isFolder ? "Folder Details" : "File Details";
		const nameField =
			detailsModal.immediateChildren[0].querySelector(".name-value");
		nameField.textContent = details.name;
		const typeField =
			detailsModal.immediateChildren[0].querySelector(".type-value");
		typeField.textContent = details.type;
		const sizeField =
			detailsModal.immediateChildren[0].querySelector(".size-value");
		sizeField.textContent = details.size + " MB";
		const locationField =
			detailsModal.immediateChildren[0].querySelector(".location-value");
		locationField.textContent = details.location;
		const ownerField =
			detailsModal.immediateChildren[0].querySelector(".owner-value");
		ownerField.textContent = details.owner;
		const timeLabel =
			detailsModal.immediateChildren[0].querySelector(".time-lable");
		timeLabel.textContent = isFolder ? "Created" : "Uploaded";
		const timeField =
			detailsModal.immediateChildren[0].querySelector(".time-value");
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

	// Share

	let currentShareItem = { id: null, type: null };

	const shareModalEl = document.querySelector(".modal.share-item");

	async function openShareModal(itemId, itemType) {
		// Store active item context
		currentShareItem = { id: itemId, type: itemType };

		const form = shareModal.form;

		// Reset form
		form.reset();
		setShareModalView("config");

		// DOM element references inside shareModal
		const itemIdInput = form.querySelector("#itemId");
		const titleEl = form.querySelector(".title");
		const accessSelect = form.querySelector("select#access");
		const durationSelect = form.querySelector("select#duration");
		const daysInput = form.querySelector("input#days");
		const hoursInput = form.querySelector("input#hours");
		const minutesInput = form.querySelector("input#minutes");

		// Configure form target
		form.action = `/share-${itemType}`;
		if (itemIdInput) itemIdInput.value = itemId;
		if (titleEl) titleEl.textContent = `Share ${itemType}`;

		try {
			// Fetch sharing metadata from server
			const response = await fetch(`/${itemType}-sharing-details/${itemId}`);
			const data = await response.json();
			const sharingDetails = data.sharingDetails;

			if (sharingDetails) {
				// Populate access setting (PUBLIC vs RESTRICTED)
				if (accessSelect) {
					accessSelect.value = sharingDetails.access;
					accessSelect.dispatchEvent(new Event("change"));
				}

				const isTimed = Boolean(sharingDetails.expiresAt);

				if (durationSelect) {
					durationSelect.value = isTimed ? "timed" : "forever";
					durationSelect.dispatchEvent(new Event("change"));
				}

				if (isTimed && sharingDetails.remainingTime) {
					if (daysInput)
						daysInput.value = sharingDetails.remainingTime.days || 0;
					if (hoursInput)
						hoursInput.value = sharingDetails.remainingTime.hours || 0;
					if (minutesInput)
						minutesInput.value = sharingDetails.remainingTime.minutes || 0;
				}

				if (!sharingDetails.isExpired && sharingDetails.access === "PUBLIC") {
					const shareLinkInput = shareModalEl?.querySelector("#shareLinkInput");
					const badge = shareModalEl?.querySelector("#linkExpirationBadge");

					if (shareLinkInput) shareLinkInput.value = sharingDetails.link || "";

					if (badge) {
						if (isTimed && sharingDetails.remainingTime) {
							const { days, hours, minutes } = sharingDetails.remainingTime;
							badge.textContent = `Expires in: ${days}d ${hours}h ${minutes}m`;
						} else {
							badge.textContent = "Link does not expire.";
						}
					}

					setShareModalView("link");
				}
			} else {
				// Default state for items that have NOT been shared yet

				if (accessSelect) {
					accessSelect.value = "RESTRICTED";
					accessSelect.dispatchEvent(new Event("change"));
				}
			}
		} catch (error) {
			console.error("Failed to fetch sharing details:", error);
		}

		shareModal?.open();

		shareModalEl?.querySelector("#shareLinkInput")?.blur();
	}

	shareModalEl
		?.querySelector("#editShareSettingsBtn")
		?.addEventListener("click", () => {
			setShareModalView("config");
		});

	shareModalEl
		?.querySelector("#doneShareBtn")
		?.addEventListener("click", () => {
			shareModal?.close();
		});

	// share form submit handling

	shareModal?.form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const form = e.target;
		const { id: itemId, type: itemType } = currentShareItem;

		if (!itemId || !itemType) return;

		const accessValue = form.access.value;

		const payload = {
			itemId: itemId,
			access: accessValue,
			duration: form.duration?.value || "forever",
			days: form.days?.value || 0,
			hours: form.hours?.value || 0,
			minutes: form.minutes?.value || 0,
		};

		try {
			const response = await fetch(`share-${itemType}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			let needsPageRefresh = false;

			shareModal?.onClose(() => {
				const isSharedPage = window.location.pathname.includes("/shared");

				if (needsPageRefresh && isSharedPage) {
					window.location.reload();
				}
			});

			if (response.ok) {
				needsPageRefresh = true;

				if (accessValue === "RESTRICTED") {
					shareModal?.close();
				} else {
					await openShareModal(itemId, itemType);
				}
			} else {
				console.error("Server error while updating share settings");
			}
		} catch (err) {
			console.error("Failed to update share settings:", err);
		}
	});

	const shareBtn = dropdown.querySelector("button.share-item");
	shareBtn?.addEventListener("click", () => {
		openShareModal(itemId, itemType);
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
