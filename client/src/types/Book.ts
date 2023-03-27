export type Book = {
    bookID: string;
    title: string;
    author: string;
    affiliation: string;
    library: string;
    subject: string;
    location: string;
    course: string;
    program: string;
    license: string;
    thumbnail: string;
    summary: string;
    rating: number;
    links: BookLinks;
    lastUpdated: string;
    libraryTags: string[];
    readerResources: ReaderResource[];
}

export type BookLinks = {
    online: string;
    pdf: string;
    buy: string;
    zip: string;
    files: string;
    lms: string;
}

export type ReaderResource = {
    name: string;
    url: string
}