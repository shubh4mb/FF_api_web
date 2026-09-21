// components/cropImageUtil.js


export const getCroppedImg = (imageSrc, pixelCrop, maxDimension = 800) => {
  const image = new Image();
  image.src = imageSrc;

  return new Promise((resolve, reject) => {
    image.onload = () => {
      // Calculate aspect-ratio-preserving downscaled dimensions
      let targetWidth = pixelCrop.width;
      let targetHeight = pixelCrop.height;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Check for transparency in the canvas to decide whether PNG is needed
      let hasAlpha = false;
      try {
        const sampleW = Math.min(targetWidth, 50);
        const sampleH = Math.min(targetHeight, 50);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
        for (let i = 3; i < imgData.length; i += 4) {
          if (imgData[i] < 250) {
            hasAlpha = true;
            break;
          }
        }
      } catch (e) {
        // Fallback if cross-origin tainted
      }

      // If no transparency, use JPEG with 0.85 quality for massive file size savings (~50-100KB)
      // If transparent, use PNG (at maxDimension, downscaled PNG is still only ~150-250KB)
      const mimeType = hasAlpha ? "image/png" : "image/jpeg";
      const quality = hasAlpha ? undefined : 0.85;

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    };
    image.onerror = reject;
  });
};

