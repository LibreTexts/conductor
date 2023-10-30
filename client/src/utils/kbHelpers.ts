import {z} from 'zod';
import { KBPage } from '../types';

export const checkIsUUID = (str?: string | null) => {
    if (!str) return false;
    const parsed = z.string().uuid().safeParse(str);
    const isUUID = parsed.success;
    return isUUID;
}

export const getKBSharingObj = (page: KBPage) => {
    return {
        title: page.title,
        text: page.description,
        url: `commons.libretexts.org/kb/page/${page.slug}`,
    }
}