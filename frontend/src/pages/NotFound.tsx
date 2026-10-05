import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { MapPinOff } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPinOff className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-black text-slate-900 tracking-tight">404</h1>
      <h2 className="text-lg font-semibold text-slate-700 mt-2">
        Page Not Found
      </h2>
      <p className="text-xs text-slate-500 mt-1 mb-6">
        The parking area or page you are searching for does not exist or has been relocated.
      </p>
      <Link to="/">
        <Button variant="primary">Return to Map</Button>
      </Link>
    </div>
  );
};

export default NotFound;
