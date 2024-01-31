import { GenericKeyTextValueObj } from "../../types";
const catalogDisplayOptions: GenericKeyTextValueObj<string>[] = [
    { key: 'visual', text: 'Visual Mode', value: 'visual' },
    { key: 'itemized', text: 'Itemized Mode', value: 'itemized' }
];

const catalogLocationOptions = [
    { key: 'central', text: 'Central Bookshelves', value: 'central' },
    { key: 'campus', text: 'Campus Bookshelves', value: 'campus' },
    // { key: 'learning', text: 'Learning Objects', value: 'learning', disabled: true }
];

const catalogAssetTypeOptions = [
    {key: 'docx', text: 'Word Document', value: 'doc'},
    {key: 'pdf', text: 'PDF', value: 'pdf'},
    {key: 'ppt', text: 'PowerPoint', value: 'ppt'},
    {key: 'xls', text: 'Excel', value: 'xls'},
    {key: 'csv', text: 'CSV', value: 'csv'},
    {key: 'html', text: 'HTML', value: 'html'},
    {key: 'png', text: 'PNG', value: 'png'},
    {key: 'jpg', text: 'JPG', value: 'jpg'},
    {key: 'jpeg', text: 'JPEG', value: 'jpeg'},
    {key: 'gif', text: 'GIF', value: 'gif'},
    {key: 'svg', text: 'SVG', value: 'svg'},
]

export {
    catalogDisplayOptions,
    catalogLocationOptions,
    catalogAssetTypeOptions
}
