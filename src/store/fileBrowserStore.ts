import { ref, watch } from 'vue';
import fileDownload from 'js-file-download';
import * as Api from '@/services/fileBrowserService';
import { getShareWithId } from '@/services/fileBrowserService';
import { Router } from 'vue-router';
import { setImageSrc } from '@/store/imageStore';
import moment from 'moment';
import { createErrorNotification, createNotification } from '@/store/notificiationStore';
import { Status } from '@/types/notifications';
import { useAuthState } from '@/store/authStore';
import { ContactInterface, DtId, SharedFileInterface } from '@/types';
import axios from 'axios';
import { calcExternalResourceLink } from '@/services/urlService';
import { watchingUsers } from '@/store/statusStore';

declare const Buffer;
export enum FileType {
    Unknown,
    Word,
    Video,
    Pdf,
    Csv,
    Audio,
    Archive,
    Excel,
    Powerpoint,
    Image,
}

export enum Action {
    CUT,
    COPY,
}

export interface PathInfoModel extends Api.PathInfo {
    fileType: FileType;
}

export interface FullPathInfoModel extends Api.EditPathInfo {
    fileType: FileType;
}

export interface ShareContent extends PathInfoModel {
    // share:
}

export const rootDirectory = '/';
export const currentDirectory = ref<string>(rootDirectory);
export const currentDirectoryContent = ref<PathInfoModel[]>([]);
export const selectedPaths = ref<PathInfoModel[]>([]);
export const copiedFiles = ref<PathInfoModel[]>([]);
export const currentSort = ref('name');
export const currentSortDir = ref('asc');
export const searchDirValue = ref<string>('');
export const searchResults = ref<PathInfoModel[] | string>([]);
export const isDraggingFiles = ref<boolean>(false);
export const selectedAction = ref<Action>(Action.COPY);
export const sharedDir = ref(false);
export const sharedContent = ref<SharedFileInterface[]>([]);

export const currentShare = ref<SharedFileInterface>(undefined);

watch([currentDirectory], () => {
    updateContent();
    sharedDir.value = false;
    selectedPaths.value = [];
    searchResults.value = [];
    searchDirValue.value = '';
});

function pathJoin(parts, separator = '/'): string {
    const replace = new RegExp(separator + '{1,}', 'g');
    return parts.join(separator).replace(replace, separator);
}

export const getFile = async (fullPath: string): Promise<FullPathInfoModel> => {
    const result = await Api.getFileInfo(fullPath);
    if (result.status !== 200 || !result.data) throw new Error('Could not get file');

    return createModel(result.data) as FullPathInfoModel;
};

export const updateContent = async (path = currentDirectory.value) => {
    const result = await Api.getDirectoryContent(path);
    if (result.status !== 200 || !result.data) throw new Error('Could not get content');

    currentDirectoryContent.value = result.data.map(createModel);
};

export const createDirectory = async (name: string, path = currentDirectory.value) => {
    const result = await Api.createDirectory(path, name);
    if ((result.status !== 200 && result.status !== 201) || !result.data)
        throw new Error('Could not create new folder');

    currentDirectoryContent.value.push(createModel(result.data));
    await updateContent();
};

export const uploadFiles = async (files: File[], path = currentDirectory.value) => {
    await Promise.all(
        files.map(async f => {
            const result = await Api.uploadFile(path, f);
            if (!result || (result.status !== 200 && result.status !== 201) || !result.data)
                throw new Error('Could not create new folder');

            currentDirectoryContent.value.push(createModel(result.data));
            await updateContent();
        })
    );
};

export const uploadFile = async (file: File, path = currentDirectory.value) => {
    const result = await Api.uploadFile(path, file);
    if ((result.status !== 200 && result.status !== 201) || !result.data)
        throw new Error('Could not create new folder');

    currentDirectoryContent.value.push(createModel(result.data));
    await updateContent();
};

export const deleteFiles = async (list: PathInfoModel[]) => {
    await Promise.all(
        list.map(async f => {
            const result = await Api.deleteFile(f.path);
            if (result.status !== 200 && result.status !== 201) throw new Error('Could not delete file');
            selectedPaths.value = [];
            await updateContent();
        })
    );
};
export const downloadFiles = async () => {
    await Promise.all(
        selectedPaths.value.map(async f => {
            const result = await Api.downloadFile(f.path);
            if (result.status !== 200 && result.status !== 201) throw new Error('Could not download file');

            fileDownload(result.data, f.fullName);
            selectedPaths.value = [];
        })
    );
};

export const downloadFileForPreview = async (path: string) => {
    const response = await Api.downloadFile(path);
    const result = window.URL.createObjectURL(response.data);
    setImageSrc(result);
};

export const goToFolderInCurrentDirectory = (item: PathInfoModel) => {
    let currentPath = currentDirectory.value;
    if (!currentPath || currentPath[currentPath.length - 1] !== rootDirectory) currentPath += '/';
    currentPath += item.name;
    currentDirectory.value = currentPath;
};

export const goToHome = () => {
    sharedDir.value = false;
    currentShare.value = undefined;
    currentDirectory.value = rootDirectory;
};

export const moveFiles = async (destination: string, items = selectedPaths.value.map(x => x.path)) => {
    if (items.includes(destination)) {
        createErrorNotification('Error while moving', 'Unable to move into itself');
        return;
    }

    const result = await Api.moveFiles(items, destination);
    if (result.status !== 200 && result.status !== 201) {
        createErrorNotification('Error while moving', 'Something went wrong');
        return;
    }

    createNotification('Move Successful', `Moved ${items.length} item(s) into ${destination}`, Status.Success);
    await updateContent();
};

export const copyPasteSelected = async () => {
    //copy
    if (copiedFiles.value.length === 0) {
        copiedFiles.value = selectedPaths.value;
        selectedPaths.value = [];
        return;
    }

    //paste
    if (selectedAction.value === Action.COPY) {
        const result = await Api.copyFiles(
            copiedFiles.value.map(x => x.path),
            currentDirectory.value
        );
        if (result.status !== 200 && result.status !== 201) throw new Error('Could not copy files');
    }
    //paste/cut
    if (selectedAction.value === Action.CUT) {
        await moveFiles(
            currentDirectory.value,
            copiedFiles.value.map(x => x.path)
        );
    }
    await clearClipboard();
    await updateContent();
};

export const clearClipboard = () => {
    copiedFiles.value = [];
    selectedPaths.value = [];
};

export const searchDir = async () => {
    const result = await Api.searchDir(searchDirValue.value, currentDirectory.value);
    if (result.status !== 200 || !result.data) throw new Error('Could not get search results');
    if (result.data.toString() === 'None') {
        searchResults.value = 'None';
        return;
    }
    searchResults.value = result.data.map(createModel);
};

export const renameFile = async (item: PathInfoModel, name: string) => {
    if (!name) return;
    const oldPath = item.path;
    let newPath = pathJoin([currentDirectory.value, name]);
    if (item.extension) newPath = pathJoin([currentDirectory.value, `${name}.${item.extension}`]);

    const result = await Api.renameFile(oldPath, newPath);
    if (result.status !== 200 && result.status !== 201) throw new Error('Could not rename file');

    selectedPaths.value = [];
    await updateContent();
};

export const goToAPreviousDirectory = (index: number) => {
    if (sharedDir.value === true) {
        sharedDir.value = false;
        return;
    }
    if (currentDirectory.value === rootDirectory) return;
    const parts = currentDirectory.value.split('/');
    if (index < 1 || index === parts.length - 1) return;
    parts.splice(index + 1);
    currentDirectory.value = pathJoin(parts);
};

export const goToFileDirectory = (item: PathInfoModel) => {
    const itemDir = item.path.substr(0, item.path.lastIndexOf('/'));
    if (item.isDirectory) {
        currentDirectory.value = item.path;
        return;
    }
    if (currentDirectory.value === itemDir) {
        searchResults.value = [];
        searchDirValue.value = '';
        return;
    }
    currentDirectory.value = itemDir;
};

export const goBack = () => {
    if (sharedDir.value) {
        sharedDir.value = false;
        return;
    }
    if (currentDirectory.value === rootDirectory) return;
    const parts = currentDirectory.value.split('/');
    parts.pop();
    console.log(parts);
    parts.length === 1 ? (currentDirectory.value = rootDirectory) : (currentDirectory.value = pathJoin(parts));
};

export const selectItem = (item: PathInfoModel) => {
    selectedPaths.value.push(item);
};

export const deselectItem = (item: PathInfoModel) => {
    selectedPaths.value = selectedPaths.value.filter(x => !equals(x, item));
};

export const equals = (item1: PathInfoModel, item2: PathInfoModel): boolean => {
    if (!item1 || !item2) return false;
    return (
        item1.fullName === item2.fullName &&
        item1.isDirectory === item2.isDirectory &&
        item1.extension === item2.extension &&
        item1.path === item2.path
    );
};

export const selectAll = () => {
    selectedPaths.value = [...currentDirectoryContent.value];
};

export const deselectAll = () => {
    selectedPaths.value = [];
};

export const itemAction = async (item: PathInfoModel, router: Router, path = currentDirectory.value) => {
    if (item.isDirectory) {
        return goToFolderInCurrentDirectory(item);
    }
    console.log(item);
    const result = router.resolve({ name: 'editfile', params: { path: btoa(pathJoin([path, item.fullName])) } });
    console.log(result);
    window.open(result.href, '_blank');
};

export const sortContent = () => {
    return currentDirectoryContent.value.sort((a, b) => {
        let modifier = 1;

        if (currentSortDir.value === 'desc') modifier = -1;
        if (currentSort.value === 'name') {
            if (!a.isDirectory && b.isDirectory) return 1;
            if (a.isDirectory && !b.isDirectory) return -1;
        }

        if (a[currentSort.value] < b[currentSort.value]) return -1 * modifier;
        if (a[currentSort.value] > b[currentSort.value]) return 1 * modifier;
        return 0;
    });
};

export const sortAction = function (s) {
    if (s === currentSort.value) {
        currentSortDir.value = currentSortDir.value === 'asc' ? 'desc' : 'asc';
    }
    currentSort.value = s;
};

export const getIcon = (item: PathInfoModel) => {
    if (item.isDirectory) return 'fas fa-folder';
    switch (item.fileType) {
        case FileType.Video:
            return 'far fa-file-video';
        case FileType.Word:
            return 'far fa-file-word';
        case FileType.Image:
            return 'far fa-file-image';
        case FileType.Pdf:
            return 'far fa-file-pdf';
        case FileType.Csv:
            return 'far fa-file-csv';
        case FileType.Audio:
            return 'far fa-file-audio';
        case FileType.Archive:
            return 'far fa-file-archive';
        case FileType.Excel:
            return 'far fa-file-excel';
        case FileType.Powerpoint:
            return 'far fa-file-powerpoint';
        default:
            return 'far fa-file';
    }
};
export const getIconDirty = (fileType: FileType) => {
    switch (fileType) {
        case FileType.Video:
            return 'far fa-file-video';
        case FileType.Word:
            return 'far fa-file-word';
        case FileType.Image:
            return 'far fa-file-image';
        case FileType.Pdf:
            return 'far fa-file-pdf';
        case FileType.Csv:
            return 'far fa-file-csv';
        case FileType.Audio:
            return 'far fa-file-audio';
        case FileType.Archive:
            return 'far fa-file-archive';
        case FileType.Excel:
            return 'far fa-file-excel';
        case FileType.Powerpoint:
            return 'far fa-file-powerpoint';
        default:
            return 'far fa-file';
    }
};

export const createModel = <T extends Api.PathInfo>(pathInfo: T): PathInfoModel => {
    return {
        ...pathInfo,
        fileType: pathInfo.isDirectory ? FileType.Unknown : getFileType(pathInfo.extension?.toLowerCase()),
    };
};

export const getFileType = (extension: string): FileType => {
    switch (extension?.toLowerCase()) {
        case 'webm':
        case 'mpg':
        case 'mpeg':
        case 'mp4':
        case 'avi':
        case 'wmv':
        case 'flv':
        case 'mov':
        case 'swf':
            return FileType.Video;
        case 'doc':
        case 'docm':
        case 'docx':
        case 'dot':
        case 'dotm':
        case 'dotx':
            return FileType.Word;
        case 'jpg':
        case 'jpeg':
        case 'tiff':
        case 'png':
        case 'bmp':
        case 'gif':
        case 'webp':
        case 'svg':
            return FileType.Image;
        case 'pdf':
            return FileType.Pdf;
        case 'csv':
            return FileType.Csv;
        case 'm4a':
        case 'flac':
        case 'mp3':
        case 'wav':
        case 'wma':
        case 'aac':
            return FileType.Audio;
        case '7z':
        case 'tar.bz2':
        case 'bz2':
        case 'tar.gz':
        case 'zip':
        case 'zipx':
        case 'gz':
        case 'rar':
            return FileType.Archive;
        case 'xlsx':
        case 'xlsm':
        case 'xlsb':
        case 'xltx':
        case 'xltm':
        case 'xls':
        case 'xlt':
        case 'xla':
        case 'xlw':
        case 'xlr':
        case 'xlam':
            return FileType.Excel;
        case 'potm':
        case 'ppa':
        case 'ppam':
        case 'pps':
        case 'ppsm':
        case 'ppsx':
        case 'ppt':
        case 'pptm':
        case 'pptx':
            return FileType.Powerpoint;
        default:
            return FileType.Unknown;
    }
};

export const getFileSize = (val: any) => {
    if (val.extension) {
        return formatBytes(val.size, 2);
    }
    return '-';
};
export const formatBytes = function (bytes, decimals) {
    if (bytes == 0) return '0 Bytes';
    let k = 1024,
        dm = decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
export const getFileExtension = (val: any) => {
    if (val.extension) {
        return val.extension;
    }
    return '-';
};
export const getFileLastModified = (val: any) => {
    const dateObj = new Date(val.lastModified);
    const dd = dateObj.getDate();
    const mm = dateObj.getMonth() + 1;
    const yyyy = dateObj.getFullYear();
    if (moment.duration(moment().startOf('day').diff(dateObj)).asDays() < -7) {
        return dd + '-' + mm + '-' + yyyy;
    }
    return moment(dateObj).fromNow();
};

export const getIconColor = (item: PathInfoModel) => {
    if (item.isDirectory) return 'text-primary';
    switch (item.fileType) {
        case FileType.Excel:
            return 'text-primarylight';
        case FileType.Word:
            return 'text-primarylight';
        case FileType.Powerpoint:
            return 'text-primarylight';
        default:
            return 'text-primarylight';
    }
};
export const getIconColorDirty = (filetype: FileType) => {
    switch (filetype) {
        case FileType.Excel:
            return 'text-green-400';
        case FileType.Word:
            return 'text-blue-400';
        case FileType.Powerpoint:
            return 'text-red-400';
        default:
            return 'text-gray-600';
    }
};

export const getSharedContent = async () => {
    const result = await Api.getShared('SharedWithMe');
    sharedContent.value = result.data;
};

export const goIntoSharedFolder = async (share: SharedFileInterface) => {
    let path: string;
    if (!currentShare.value) {
        path = '/';
        currentShare.value = share;
    } else {
        path = share.path;
    }
    const items = await getSharedFolderContent(share.owner, share.id, path);
    sharedContent.value = items.map(item => {
        let itemName = item.name;
        if (item.extension) {
            itemName = itemName + '.' + item.extension;
        }
        return <SharedFileInterface>{
            id: share.id,
            path: item.path,
            owner: share.owner,
            name: itemName,
            isFolder: item.isDirectory,
            size: item.size,
            lastModified: item.lastModified.getTime ? item.lastModified.getTime() : undefined,
            permissions: share.permissions,
        };
    });
};

export const addShare = async (userId: string, path: string, filename: string, size: number, writable) => {
    return await Api.addShare(userId, path, filename, size, writable);
};

export const parseJwt = token => {
    let base64Url = token.split('.')[1];
    return JSON.parse(Buffer.from(base64Url, 'base64').toString());
};

export const getExtension = filename => {
    return filename.substring(filename.lastIndexOf('.') + 1);
};

export const fetchShareDetails = async (shareId: string) => {
    const shareDetails = await getShareWithId(shareId);
    return shareDetails;
};

export const fetchFileAccessDetails = async (owner: ContactInterface, shareId: string, path: string) => {
    const { user } = useAuthState();
    const fileAccessDetails = await Api.getFileAccessDetails(owner, shareId, <string>user.id, path);
    return fileAccessDetails;
};

export const getExternalPathInfo = async (digitalTwinId: DtId, token: string, shareId: string) => {
    const { user } = useAuthState();
    let params = { shareId: shareId, token: token };
    const locationApiEndpoint = `/api/browse/files/info?params=${btoa(JSON.stringify(params))}`;
    let location = '';
    if (digitalTwinId == user.id) {
        location = `${window.location.origin}${locationApiEndpoint}`;
    } else {
        location = calcExternalResourceLink(
            `http://[${watchingUsers[<string>digitalTwinId].location}]${locationApiEndpoint}`
        );
    }
    // TODO: url encoding
    const response = await axios.get(location);
    return response.data;
};

export const getSharedFolderContent = async (owner, shareId, path: string) => {
    const { user } = useAuthState();
    return await Api.getSharedFolderContent(owner, shareId, <string>user.id, path);
};
