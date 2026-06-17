import { db } from "./auth.js";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const categoriesList = document.getElementById("categories-list");
const categoryError = document.getElementById("category-error");
const addCategoryBtn = document.getElementById("add-category-btn");

let currentUserId = null;

/**
 * Initializes the categories management
 * @param {string} uid
 */
export function initCategories(uid) {
    currentUserId = uid;
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener("click", () => handleAddCategory());
    }
    fetchCategories();
}

/**
 * Fetches categories from Firestore and renders them
 */
export async function fetchCategories() {
    if (!currentUserId) return;

    try {
        const q = query(
            collection(db, "menuCategories"),
            where("restaurantId", "==", currentUserId),
            orderBy("createdAt", "asc")
        );

        const querySnapshot = await getDocs(q);
        const categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        renderCategories(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        // If index is missing, we might get an error. Firebase will provide a link to create it.
        if (error.code === 'failed-precondition') {
            showError("Database optimization in progress. Please wait a moment.");
        } else {
            showError(getFriendlyErrorMessage(error));
        }
    }
}

/**
 * Renders the categories list in the DOM
 * @param {Array} categories
 */
function renderCategories(categories) {
    if (!categoriesList) return;

    categoriesList.innerHTML = "";

    if (categories.length === 0) {
        categoriesList.innerHTML = "<p>No categories added yet.</p>";
        return;
    }

    categories.forEach((category) => {
        const li = document.createElement("li");
        li.className = "detail-item";
        li.style.alignItems = "center";

        const nameSpan = document.createElement("span");
        nameSpan.className = "value";
        nameSpan.innerText = category.name;

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "category-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-outline btn-small";
        editBtn.style.marginRight = "0.5rem";
        editBtn.innerText = "Edit";
        editBtn.onclick = () => handleEditCategory(category);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-outline btn-small";
        deleteBtn.style.color = "var(--error-color)";
        deleteBtn.innerText = "Delete";
        deleteBtn.onclick = () => handleDeleteCategory(category.id);

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);

        categoriesList.appendChild(li);
    });
}

/**
 * Maps Firebase error codes or other errors to friendly messages
 * @param {Error} error
 * @returns {string}
 */
function getFriendlyErrorMessage(error) {
    if (error.code === 'permission-denied') {
        return "You don't have permission to perform this action.";
    }
    if (error.message && error.message.includes("network")) {
        return "Network error. Please check your connection.";
    }
    return "An unexpected error occurred. Please try again.";
}

/**
 * Shows an error message to the user
 * @param {string} message
 */
function showError(message) {
    if (categoryError) {
        categoryError.innerText = message;
        categoryError.classList.remove("hidden");
        setTimeout(() => {
            categoryError.classList.add("hidden");
        }, 5000);
    } else {
        alert(message);
    }
}

/**
 * Validates a category name and checks for duplicates
 * @param {string} name
 * @param {string|null} excludeId ID to exclude from duplicate check (for edits)
 * @returns {Promise<boolean>}
 */
async function validateCategory(name, excludeId = null) {
    const trimmedName = name.trim();

    if (!trimmedName) {
        showError("Category name is required.");
        return false;
    }

    if (trimmedName.length > 50) {
        showError("Category name must be 50 characters or less.");
        return false;
    }

    try {
        const q = query(
            collection(db, "menuCategories"),
            where("restaurantId", "==", currentUserId),
            where("name", "==", trimmedName)
        );
        const querySnapshot = await getDocs(q);

        let isDuplicate = false;
        querySnapshot.forEach((doc) => {
            if (excludeId === null || doc.id !== excludeId) {
                isDuplicate = true;
            }
        });

        if (isDuplicate) {
            showError("A category with this name already exists.");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Validation error:", error);
        showError(getFriendlyErrorMessage(error));
        return false;
    }
}

/**
 * Handles the "Add Category" button click
 */
async function handleAddCategory() {
    const categoryName = prompt("Enter the name of the new category:");

    if (categoryName === null) return; // User cancelled

    const isValid = await validateCategory(categoryName);
    if (!isValid) return;

    try {
        await addDoc(collection(db, "menuCategories"), {
            restaurantId: currentUserId,
            name: categoryName.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await fetchCategories();
    } catch (error) {
        console.error("Error adding category:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

/**
 * Handles the "Edit" button click
 * @param {Object} category
 */
async function handleEditCategory(category) {
    const newName = prompt("Edit category name:", category.name);

    if (newName === null || newName.trim() === category.name) return;

    const isValid = await validateCategory(newName, category.id);
    if (!isValid) return;

    try {
        const categoryRef = doc(db, "menuCategories", category.id);
        await updateDoc(categoryRef, {
            name: newName.trim(),
            updatedAt: serverTimestamp()
        });

        await fetchCategories();
    } catch (error) {
        console.error("Error updating category:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

/**
 * Handles the "Delete" button click
 * @param {string} categoryId
 */
async function handleDeleteCategory(categoryId) {
    const confirmed = confirm("Are you sure you want to delete this category?");

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "menuCategories", categoryId));
        await fetchCategories();
    } catch (error) {
        console.error("Error deleting category:", error);
        showError(getFriendlyErrorMessage(error));
    }
}
