import { useState, useCallback } from 'react';
import getCroppedImg from './cropImage';

export const useImageCropper = () => {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const showCroppedImage = async () => {
        try {
            const croppedImageBlob = await getCroppedImg(
                imageSrc,
                croppedAreaPixels
            );
            return croppedImageBlob; // Returns a Blob
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    const resetCropper = () => {
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
    };

    return {
        imageSrc,
        setImageSrc,
        crop,
        setCrop,
        zoom,
        setZoom,
        onCropComplete,
        showCroppedImage,
        resetCropper
    };
};
