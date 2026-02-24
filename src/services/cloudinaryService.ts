export const cloudinaryService = {
    uploadFile: async (file: File, resourceType: 'image' | 'video' = 'image'): Promise<string> => {
        const url = import.meta.env.VITE_CLOUDINARY_URL;
        const preset = import.meta.env.VITE_CLOUDINARY_PRESET;

        if (!url || !preset) {
            throw new Error('Cloudinary configuration missing');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', preset);

        try {
            const response = await fetch(`${url}/${resourceType}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const data = await response.json();
            return data.secure_url;
        } catch (error: any) {
            console.error('[Cloudinary] Upload error:', error);
            throw new Error(error.message || 'Network error during upload');
        }
    }
};
