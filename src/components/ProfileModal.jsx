import { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose, profile, setProfile, isFirstTime, onResetMarks }) {
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
  const [showConfirm, setShowConfirm] = useState(false);

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

  const performSave = async () => {
    setSaving(true);
    setError('');

    const facultyChanged = profile && profile.faculty && profile.faculty !== formData.faculty;
    
    // Save to localStorage as backup
    localStorage.setItem(`profile_${user.uid}`, JSON.stringify({ ...formData, email: user.email }));

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'data');
      const savePromise = setDoc(profileRef, { ...formData, email: user.email, updatedAt: new Date().toISOString() });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000));
      
      await Promise.race([savePromise, timeoutPromise]);

      // If faculty changed, reset all marks
      if (facultyChanged && onResetMarks) {
        await onResetMarks();
      }
    } catch (err) {
      console.warn('Could not sync profile to cloud, but saved locally:', err);
    } finally {
      setSaving(false);
      setProfile(formData);
      onClose();
    }
  };

  const handleDeleteAccount = async () => {
    const doubleConfirm = window.confirm(
      "DANGER: Are you sure you want to delete your account? All your marks and profile data will be permanently erased. This cannot be undone."
    );
    
    if (!doubleConfirm) return;

    setSaving(true);
    try {
      // 1. Delete Firestore data
      const batch = writeBatch(db);
      for (let sem = 1; sem <= 8; sem++) {
        batch.delete(doc(db, 'users', user.uid, 'semesters', String(sem)));
      }
      batch.delete(doc(db, 'users', user.uid, 'profile', 'data'));
      await batch.commit();

      // 2. Clear local storage
      localStorage.removeItem(`profile_${user.uid}`);
      localStorage.removeItem(`marks_${user.uid}`);
      localStorage.removeItem(`marks_timestamp_${user.uid}`);

      // 3. Delete Auth User
      await deleteUser(user);
      onClose();
    } catch (err) {
      console.error('Error deleting account:', err);
      setError("Sensitive action requires recent login. Please log out and log in again, then try deleting your account.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.faculty.trim()) {
      setError('Name and Faculty are required.');
      return;
    }

    // Check if faculty is being changed on an existing profile
    if (profile && profile.faculty && profile.faculty !== formData.faculty) {
      setShowConfirm(true);
      return;
    }

    await performSave();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center px-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Times New Roman', serif" }}>
              {isFirstTime ? 'Complete Your Profile' : 'Edit Profile'}
            </h2>
            {!isFirstTime && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form id="profile-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all text-sm outline-none"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Faculty <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.faculty}
                    onChange={(e) => setFormData({...formData, faculty: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all bg-white text-sm outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select Faculty</option>
                    <option value="BCE">Civil (BCE)</option>
                    <option value="BCT">Computer (BCT)</option>
                    <option value="BEL">Electrical (BEL)</option>
                    <option value="BEI">Electronics (BEI)</option>
                    <option value="BME">Mechanical (BME)</option>
                    <option value="B.Arch">Architecture (B.Arch)</option>
                    <option value="BIE">Industrial (BIE)</option>
                    <option value="BAG">Agriculture (BAG)</option>
                    <option value="BGE">Geomatics (BGE)</option>
                    <option value="BAM">Automobile (BAM)</option>
                    <option value="BAE">Aerospace (BAE)</option>
                    <option value="BCH">Chemical (BCH)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Semester</label>
                  <select
                    value={formData.currentSemester}
                    onChange={(e) => setFormData({...formData, currentSemester: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all bg-white text-sm outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={String(sem)}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Campus (Optional)</label>
                <input
                  type="text"
                  value={formData.campus}
                  onChange={(e) => setFormData({...formData, campus: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all text-sm outline-none"
                  placeholder="e.g., Pulchowk Campus"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all text-sm outline-none"
                    placeholder="City, District"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all text-sm outline-none"
                    placeholder="e.g., 98XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Photo URL</label>
                <input
                  type="url"
                  value={formData.photoURL}
                  onChange={(e) => setFormData({...formData, photoURL: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 transition-all text-sm outline-none"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              {!isFirstTime && (
                <div className="pt-6 border-t border-gray-100 mt-6">
                  <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Danger Zone</h4>
                  <p className="text-[10px] text-gray-400 mb-3 italic">Warning: Deleting your account will erase all your marks and profile data permanently.</p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="w-full px-4 py-2.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete My Account
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
            {!isFirstTime && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition text-sm"
              >
                Cancel
              </button>
            )}
            <button
              form="profile-form"
              type="submit"
              disabled={saving}
              className="flex-[2] px-4 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition shadow-lg shadow-gray-200 flex items-center justify-center gap-2 text-sm"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : isFirstTime ? 'Create Profile' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative transform transition-all duration-200 scale-100">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Changing Faculty?</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                You are changing your faculty from <span className="font-bold text-gray-800">{profile.faculty}</span> to <span className="font-bold text-gray-800">{formData.faculty}</span>. 
                <br/><br/>
                This will reset your dashboard to the new faculty subjects. Marks for subjects not in the new curriculum will be hidden.
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-6 py-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition border-r border-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowConfirm(false);
                  await performSave();
                }}
                className="flex-1 px-6 py-4 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
