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

	const firstChild = backdrop.querySelector("& > *");
	const form = backdrop.querySelector("form");
	const cancelBtn = backdrop.querySelector(".cancel-btn");
	const primaryInput = backdrop.querySelector("input[type='text']");

	backdrop.addEventListener("click", (e) => {
		e.stopPropagation();
		if (firstChild && !firstChild.contains(e.target)) {
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

	return { open, close, backdrop, form, firstChild };
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
			<span class="folder-name">${node?.name == "root" ? "Home" : node?.name}</span> 
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

export const renameModal = setupModal(".modal.rename-item");

const createFolderModal = setupModal(".modal.add-folder");

document.querySelector(".new-folder-btn")?.addEventListener("click", () => {
	createFolderModal?.open();
});

const baseMoveModal = setupModal(".modal.move-item");

export const moveItemModal = setupMoveItemModal(baseMoveModal);

export const detailsModal = setupModal(".modal.item-details");
