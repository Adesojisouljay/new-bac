export const cloudinaryService = {
    uploadFile: async (
        file: File,
        resourceType: 'image' | 'video' = 'image',
        onProgress?: (progress: number) => void
    ): Promise<string> => {
        const url = import.meta.env.VITE_CLOUDINARY_URL;
        const preset = import.meta.env.VITE_CLOUDINARY_PRESET;

        if (!url || !preset) {
            throw new Error('Cloudinary configuration missing');
        }

        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', preset);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${url}/${resourceType}/upload`);

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.secure_url);
                } else {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.message || 'Upload failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(formData);
        });
    }
};
