import { BookSortOption } from "../types";

export const isBookSortOption = (text: string): text is BookSortOption => {
    return (
        text === "title" ||
        text === "author" ||
        text === "random"
    );
}