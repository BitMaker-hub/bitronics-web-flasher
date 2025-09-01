import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import device_data from './firmware_data.json';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectDevice: (name: string) => any;
}

export default function DeviceModal({ isOpen, onClose, selectDevice }: DeviceModalProps) {
  const { t } = useTranslation();
  const devices = device_data.devices;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } transition-opacity duration-300 z-40`}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-h-[85vh] w-full max-w-4xl px-4 overflow-scroll p-4 shadow-lg ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        } transition-all duration-300 ease-in-out rounded-lg z-50 device-modal`}
      >
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>
      <h2 className="text-xl font-bold mb-4 text-white">{t('devicesModal.title')}</h2>
      <div className="flex flex-wrap gap-8 justify-center p-6">
        {devices.map((d) => (
          <div
            key={d.name}
            className="max-w-1/3 md:max-w-1/4"
            onClick={() => {
              selectDevice(d.name);
            }}
          >
            <img className="mb-2 w-30 h-30 mx-auto object-contain" src={d.picture} alt={d.name} />
            <div className="mb-4 w-full text-center text-white">{d.name}</div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
