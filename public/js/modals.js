function setupModal(backdropSelector) {
	const backdrop = document.querySelector(backdropSelector);
	if (!backdrop) return null;

	const immediateChildren = [...backdrop.children];
	const form = backdrop.querySelector("form");
	const cancelBtn = backdrop.querySelector(".cancel-btn");
	const primaryInput = backdrop.querySelector("input[type='text']");

	let mouseDownTarget = null;
	let onCloseCallback = null;

	function clearErrors() {
		if (!form) return;
		form.querySelectorAll("[data-error-for]").forEach((error) => {
			error.textContent = "";
			error.classList.remove("active");
		});
	}

	backdrop.addEventListener("mousedown", (e) => {
		mouseDownTarget = e.target;
	});

	backdrop.addEventListener("mouseup", (e) => {
		e.stopPropagation();
		const startedOutside = !immediateChildren.some((child) =>
			child.contains(mouseDownTarget),
		);
		const endedOutside = !immediateChildren.some((child) =>
			child.contains(e.target),
		);

		if (startedOutside && endedOutside) {
			close();
		}

		mouseDownTarget = null;
	});

	cancelBtn?.addEventListener("click", () => {
		close();
	});

	function open() {
		clearErrors();
		backdrop.classList.add("active");
		if (primaryInput) {
			primaryInput.focus();
		}
	}

	function close() {
		backdrop.classList.remove("active");
		if (form) {
			form.reset();
			clearErrors();
		}
		
		if (typeof onCloseCallback == "function") {
			onCloseCallback();
		}
	}

	function onClose(callback) {
		onCloseCallback = callback;
	}

	return { open, close, onClose, backdrop, form, immediateChildren };
}

function setupMoveItemModal(modalInstance) {
	if (!modalInstance) return null;

	const { open: originalOpen, close, backdrop, form } = modalInstance;
	const treeContainer = backdrop.querySelector(".folder-tree-container");
	const itemIdInput = backdrop.querySelector("input[name='itemId']");

	async function open(itemIdToMove) {
		if (itemIdInput) {
			itemIdInput.value = itemIdToMove;
		}

		if (treeContainer) {
			treeContainer.innerHTML = "<p class='loading'> Loading folder... </p>";
		}

		originalOpen();

		try {
			const response = await fetch("/folder-tree");
			const data = await response.json();

			if (data.success && treeContainer) {
				treeContainer.innerHTML = "";
				renderTree(data.folderTree, treeContainer, itemIdToMove);
			} else {
				if (treeContainer)
					treeContainer.innerHTML =
						"<p class='error'> Failed to load folders. </p>";
			}
		} catch (err) {
			console.error("Could not fetch folder tree:", err);
			if (treeContainer)
				treeContainer.innerHTML = "<p class='error'>Error loading folders.</p>";
		}
	}

	function renderTree(node, container, itemIdToMove) {
		if (node.id === itemIdToMove) return;

		const ul = document.createElement("ul");
		ul.className = "tree-list";

		const li = document.createElement("li");
		li.className = "tree-item-wrapper";

		const row = document.createElement("div");
		row.className = "folder-row";

		const hasChildren = node.children && node.children.length > 0;

		const hasFolderChild =
			node.children &&
			node.children.some((child) => String(child.id) === String(itemIdToMove));

		const hasFileChild =
			node.files &&
			node.files.some((file) => String(file.id) === String(itemIdToMove));

		const leftSide = document.createElement("div");
		leftSide.className = "folder-left";

		const caretSpan = document.createElement("span");
		caretSpan.className = "material-symbols-outlined caret";
		if (hasChildren) {
			caretSpan.textContent = "keyboard_arrow_right";
			caretSpan.classList.add("has-children");
		} else {
			caretSpan.textContent = "";
			caretSpan.classList.add("empty-placeholder");
		}

		leftSide.innerHTML = `
			${caretSpan.outerHTML}
			<span class="material-symbols-outlined folder-icon">folder</span>
			<span class="folder-name">${node?.name}</span> 
		`;

		const moveBtn = document.createElement("button");
		moveBtn.type = "button";
		moveBtn.className = "inline-move-btn";
		moveBtn.innerHTML = `
			<span class="material-symbols-outlined">drive_file_move</span>
			<span>Move</span>
		`;

		const isCurrentParent = hasFolderChild || hasFileChild;

		if (isCurrentParent) {
			moveBtn.disabled = true;
			moveBtn.classList.add("disabled");
			moveBtn.title = "Item is already in this folder";
		} else {
			moveBtn.addEventListener("click", (e) => {
				e.stopPropagation();

				const destinationInput = backdrop.querySelector(
					"input[name='destinationFolderId']",
				);
				if (destinationInput) {
					destinationInput.value = node.id;
				}

				if (form) form.submit();
			});
		}

		row.appendChild(leftSide);
		row.appendChild(moveBtn);
		li.appendChild(row);

		if (hasChildren) {
			const childrenContainer = document.createElement("div");
			childrenContainer.className = "children-container collapsed";

			node.children.forEach((child) => {
				if (child.id && !child.ext) {
					renderTree(child, childrenContainer, itemIdToMove);
				}
			});

			if (childrenContainer.childElementCount > 0) {
				li.appendChild(childrenContainer);

				const rowCaret = row.querySelector(".caret");
				const toggleExpand = (e) => {
					e.stopPropagation();
					const isCollapsed = childrenContainer.classList.toggle("collapsed");
					rowCaret.textContent = isCollapsed
						? "keyboard_arrow_right"
						: "keyboard_arrow_down";
				};

				rowCaret.addEventListener("click", toggleExpand);
				row
					.querySelector(".folder-name")
					.addEventListener("click", toggleExpand);
			} else {
				const caret = row.querySelector(".caret");
				if (caret) {
					caret.textContent = "";
					caret.className = "material-symbols-outlined caret empty-placeholder";
				}
			}
		}

		ul.appendChild(li);
		container.appendChild(ul);
	}

	return { open, close, backdrop, form };
}

export function setShareModalView(view) {
	const shareModalEl = document.querySelector(".modal.share-item");
	const configView = shareModalEl?.querySelector(".share-config-view");
	const linkView = shareModalEl?.querySelector(".share-link-view");

	if (view === "link") {
		configView?.classList.add("hidden");
		linkView?.classList.remove("hidden");
	} else {
		configView?.classList.remove("hidden");
		linkView?.classList.add("hidden");
	}
}

export const renameModal = setupModal(".modal.rename-item");

const newItemModal = setupModal(".modal.new-item");
const createFolderModal = setupModal(".modal.add-folder");
const uploadForm = document.querySelector(".upload-form");
const uploadField = uploadForm?.querySelector("input[type='file']");

document.querySelector(".new-btn")?.addEventListener("click", () => {
	newItemModal?.open();
});

document
	.querySelector(".modal.new-item .new-folder-btn")
	?.addEventListener("click", () => {
		newItemModal?.close();
		createFolderModal?.open();
	});

document
	.querySelector(".modal.new-item .upload-file-btn")
	?.addEventListener("click", () => {
		newItemModal?.close();
		uploadField?.click();
	});

uploadField?.addEventListener("change", () => {
	if (uploadField.files.length > 0 && uploadForm) {
		uploadForm.submit();
	}
});

const baseMoveModal = setupModal(".modal.move-item");

export const moveItemModal = setupMoveItemModal(baseMoveModal);

export const detailsModal = setupModal(".modal.item-details");

export const deleteModal = setupModal(".modal.delete-item");

const emptyTrashModal = setupModal(".modal.empty-trash");

document.querySelector(".empty-trash-btn")?.addEventListener("click", () => {
	emptyTrashModal?.open();
});

export const shareModal = setupModal(".modal.share-item");

export const supportModal = setupModal(".modal.support-info");

document.querySelector(".support-btn")?.addEventListener("click", () => {
	supportModal?.open();
});
