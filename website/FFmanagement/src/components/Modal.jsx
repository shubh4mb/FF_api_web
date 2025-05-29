const Modal = ({ children, onClose }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow-lg w-[90%] max-w-lg relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-600 hover:text-black"
          >
            ✕
          </button>
          {children}
        </div>
      </div>
    );
  };
  
  export default Modal;
  