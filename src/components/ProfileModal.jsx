import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose, profile, setProfile, isFirstTime }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    faculty: '',
    campus: '',
    address: '',
    phone: '',
    currentSemester: '1',
    photoURL: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        faculty: profile.faculty || '',
        campus: profile.campus || '',
        address: profile.address || '',
        phone: profile.phone || '',
        currentSemester: profile.currentSemester || '1',
        photoURL: profile.photoURL || ''
      });
    } else if (user) {
        setFormData(prev => ({
            ...prev,
            photoURL: user.photoURL || ''
        }));
    }
  }, [profile, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.faculty.trim()) {
      setError('Name and Faculty are required.');
      return;
    }

    setSaving(true);
    
    // Save to localStorage as backup
    localStorage.setItem(`profile_${user.uid}`, JSON.stringify({ ...formData, email: user.email }));

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'data');
      const savePromise = setDoc(profileRef, { ...formData, email: user.email, updatedAt: new Date().toISOString() });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000));
      
      await Promise.race([savePromise, timeoutPromise]);
    } catch (err) {
      console.warn('Could not sync profile to cloud, but saved locally:', err);
    } finally {
      setSaving(false);
      setProfile(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Times New Roman', serif" }}>
            {isFirstTime ? 'Complete Your Profile' : 'Edit Profile'}
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Read-only)</label>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faculty <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.faculty}
                onChange={(e) => setFormData({...formData, faculty: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
                placeholder="e.g., BCT, BCE, BEX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campus (Optional)</label>
              <input
                type="text"
                value={formData.campus}
                onChange={(e) => setFormData({...formData, campus: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
                placeholder="e.g., Pulchowk Campus"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Semester</label>
              <select
                value={formData.currentSemester}
                onChange={(e) => setFormData({...formData, currentSemester: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (Optional)</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL (Optional)</label>
              <input
                type="url"
                value={formData.photoURL}
                onChange={(e) => setFormData({...formData, photoURL: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:outline-none"
                placeholder="https://..."
              />
            </div>

            <div className="flex gap-3 pt-4 border-t mt-6">
              {!isFirstTime && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded font-medium transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded font-medium hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
