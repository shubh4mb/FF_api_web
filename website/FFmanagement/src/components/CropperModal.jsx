import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "../utils/cropImage";
import Modal from "./Modal";

const CropperModal = ({ imageSrc, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect, setAspect] = useState(1 / 1); // default square

  const handleCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDone = async () => {
    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCropComplete(croppedBlob);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-4">
     

        <div className="relative w-full h-[400px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="flex justify-end gap-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <label className="font-semibold">Aspect Ratio:</label>
          <select
            value={aspect}
            onChange={(e) => setAspect(Number(e.target.value))}
            className="border p-1 rounded"
          >
            <option value={1 / 1}>1:1 (Square)</option>
            <option value={4 / 3}>4:3</option>
            <option value={16 / 9}>16:9</option>
            <option value={3 / 4}>3:4 (Portrait)</option>
          </select>
        </div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleDone} className="px-4 py-2 bg-blue-600 text-white rounded">
            Crop
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CropperModal;
