import {
	moveItemModal,
	renameModal,
	detailsModal,
	deleteModal,
	shareModal,
	setShareModalView,
} from "./modals.js";

function showToast(message, type = "success", duration = 2600) {
	const container = document.getElementById("toast-container");
	if (!container || !message) return;

	const toast = document.createElement("div");
	toast.className = `toast ${type}`;
	toast.setAttribute("role", "status");
	toast.textContent = message;

	const icon = document.createElement("span");
	icon.className = "material-symbols-outlined toast-icon";
	icon.textContent = type === "error" ? "error" : "check";
	toast.prepend(icon);

	container.appendChild(toast);

	requestAnimationFrame(() => {
		toast.classList.add("visible");
	});

	window.setTimeout(() => {
		toast.classList.remove("visible");
		window.setTimeout(() => toast.remove(), 200);
	}, duration);
}

window.showToast = showToast;

const toastMessage = new URLSearchParams(window.location.search).get("toast");
const toastType =
	new URLSearchParams(window.location.search).get("toastType") || "success";

if (toastMessage) {
	showToast(decodeURIComponent(toastMessage), toastType);
	const url = new URL(window.location.href);
	url.searchParams.delete("toast");
	url.searchParams.delete("toastType");
	window.history.replaceState({}, "", url);
}

const itemElements = document.querySelectorAll(".item");

const shareModalEl = document.querySelector(".modal.share-item");
let currentShareItem = { id: null, type: null };

async function openShareModal(itemId, itemType) {
	currentShareItem = { id: itemId, type: itemType };

	const form = shareModal.form;
	form.reset();
	setShareModalView("config");

	const itemIdInput = form.querySelector("#itemId");
	const titleEl = form.querySelector(".title");
	const accessSelect = form.querySelector("select#access");
	const durationSelect = form.querySelector("select#duration");
	const daysInput = form.querySelector("input#days");
	const hoursInput = form.querySelector("input#hours");
	const minutesInput = form.querySelector("input#minutes");

	form.action = `/share-${itemType}`;
	if (itemIdInput) itemIdInput.value = itemId;
	if (titleEl) titleEl.textContent = `Share ${itemType}`;

	try {
		const response = await fetch(`/${itemType}-sharing-details/${itemId}`);
		const data = await response.json();
		const sharingDetails = data.sharingDetails;

		if (sharingDetails) {
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
				if (daysInput) daysInput.value = sharingDetails.remainingTime.days || 0;
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

window.openShareModal = openShareModal;

shareModalEl
	?.querySelector("#editShareSettingsBtn")
	?.addEventListener("click", () => {
		setShareModalView("config");
	});

shareModalEl?.querySelector("#doneShareBtn")?.addEventListener("click", () => {
	shareModal?.close();
});

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
		const shareRoute = `/share-${itemType}`;
		const response = await fetch(shareRoute, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			const toastMessage =
				accessValue === "PUBLIC"
					? "Share link generated"
					: "Share settings updated";
			const isSharePage = window.location.pathname.startsWith("/share/");
			const isSharedPage = window.location.pathname === "/shared";

			if (isSharePage || isSharedPage) {
				const destination = new URL(
					isSharePage ? "/" : window.location.href,
					window.location.origin,
				);
				destination.searchParams.set("toast", toastMessage);
				destination.searchParams.set("toastType", "success");
				window.location.assign(destination);
				return;
			}

			if (accessValue === "RESTRICTED") {
				showToast(toastMessage, "success");
				shareModal?.close();
			} else {
				showToast(toastMessage, "success");
				await openShareModal(itemId, itemType);
			}
		} else {
			const result = await response.json();
			Object.entries(result.errors || {}).forEach(([field, messages]) => {
				const error = form.querySelector(`[data-error-for="${field}"]`);
				if (!error) return;
				error.textContent = messages[0];
				error.classList.add("active");
			});
		}
	} catch (err) {
		console.error("Failed to update share settings:", err);
	}
});

function setupCustomTooltip(item) {
	const tooltip = document.createElement("div");
	tooltip.className = "custom-tooltip";
	document.body.appendChild(tooltip);
	item._tooltip = tooltip;

	let tooltipTimer = null;
	let lastPointerX = 0;
	let lastPointerY = 0;

	const hideTooltip = () => {
		if (tooltipTimer) {
			clearTimeout(tooltipTimer);
			tooltipTimer = null;
		}
		tooltip.classList.remove("visible");
	};

	const positionTooltip = (x, y) => {
		tooltip.style.left = `${x + 12}px`;
		tooltip.style.top = `${y + 10}px`;
	};

	const showTooltip = (event) => {
		if (item.classList.contains("tooltip-disabled")) return;

		lastPointerX = event.clientX;
		lastPointerY = event.clientY;

		const text = item.dataset.tooltip || item.dataset.name || item.id;
		if (!text) return;

		if (tooltipTimer) {
			clearTimeout(tooltipTimer);
		}

		tooltipTimer = setTimeout(() => {
			tooltip.textContent = text;
			tooltip.classList.add("visible");
			positionTooltip(lastPointerX, lastPointerY);
		}, 500);
	};

	item.addEventListener("mouseenter", showTooltip);
	item.addEventListener("mousemove", (event) => {
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;

		if (tooltip.classList.contains("visible")) {
			positionTooltip(lastPointerX, lastPointerY);
		}
	});
	item.addEventListener("mouseleave", hideTooltip);
	item.addEventListener("click", hideTooltip);
}

itemElements.forEach((item) => {
	setupCustomTooltip(item);
});

// handle drop down menu

let activeDropdown = null;
let positionFrame = null;

function positionDropdown(menuBtn, dropdown) {
	if (!dropdown.classList.contains("active")) return;

	const dropdownRect = dropdown.getBoundingClientRect();
	const buttonRect = menuBtn.getBoundingClientRect();
	const margin = 15;
	const gap = -5;
	const spaceRight = window.innerWidth - buttonRect.right - gap - margin;
	const spaceLeft = buttonRect.left - gap - margin;
	const preferredLeft =
		spaceRight >= dropdownRect.width
			? buttonRect.right + gap
			: spaceLeft >= dropdownRect.width
				? buttonRect.left - dropdownRect.width - gap
				: spaceRight >= spaceLeft
					? buttonRect.right + gap
					: buttonRect.left - dropdownRect.width - gap;
	const maxLeft = window.innerWidth - dropdownRect.width - margin;
	const left = Math.max(margin, Math.min(preferredLeft, maxLeft));
	const spaceBelow = window.innerHeight - buttonRect.bottom - gap - margin;
	const spaceAbove = buttonRect.top - gap - margin;
	const preferredTop =
		spaceBelow >= dropdownRect.height
			? buttonRect.bottom + gap
			: spaceAbove >= dropdownRect.height
				? buttonRect.top - dropdownRect.height - gap
				: spaceBelow >= spaceAbove
					? buttonRect.bottom + gap
					: buttonRect.top - dropdownRect.height - gap;
	const maxTop = window.innerHeight - dropdownRect.height - margin;

	dropdown.style.left = `${left}px`;
	dropdown.style.right = "auto";
	dropdown.style.top = `${Math.max(margin, Math.min(preferredTop, maxTop))}px`;
	dropdown.style.bottom = "auto";
}

function repositionActiveDropdown() {
	if (!activeDropdown || positionFrame) return;

	positionFrame = requestAnimationFrame(() => {
		positionFrame = null;
		if (activeDropdown) {
			positionDropdown(activeDropdown.menuBtn, activeDropdown.dropdown);
		}
	});
}

window.addEventListener("resize", repositionActiveDropdown);
document.addEventListener("scroll", repositionActiveDropdown, {
	capture: true,
	passive: true,
});

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
				otherItem.classList.remove("tooltip-disabled");
			}
		});

		const isOpening = !dropdown.classList.contains("active");
		dropdown.classList.toggle("active");
		item.classList.toggle("tooltip-disabled", isOpening);
		if (item._tooltip) {
			item._tooltip.classList.remove("visible");
		}

		if (isOpening) {
			dropdown.style.left = "";
			dropdown.style.right = "";
			dropdown.style.top = "";
			dropdown.style.bottom = "";

			activeDropdown = { menuBtn, dropdown };
			positionDropdown(menuBtn, dropdown);
		} else {
			activeDropdown = null;
		}
	});
});

document.addEventListener("click", () => {
	itemElements.forEach((item) => {
		const dropdown = item.querySelector(".item-dropdown");
		dropdown.classList.remove("active");
		item.classList.remove("tooltip-disabled");
		if (item._tooltip) {
			item._tooltip.classList.remove("visible");
		}
	});
	activeDropdown = null;
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
			window.location.href =
				item.getAttribute("data-open-url") || `/folder/${itemId}`;
		} else {
			const fileURL = item.getAttribute("data-url");
			if (fileURL) window.open(fileURL, "_blank");
		}
	};

	item.addEventListener("click", (event) => {
		if (
			event.target.closest(".item-menu-wrapper, .item-dropdown, .star-form")
		) {
			return;
		}

		handleOpen();
	});

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
