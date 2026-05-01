import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import semesterData from '../data/semesterData';
import MarksheetTable from '../components/MarksheetTable';
import ProfileModal from '../components/ProfileModal';
import { exportSemesterPDF, exportAllSemestersPDF, computeTotals } from '../utils/pdfExport';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [allMarks, setAllMarks] = useState({
    1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop

  // Profile state
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Scroll spy refs
  const semesterRefs = useRef([]);

  // Load profile and all marks once
  const loadData = useCallback(async () => {
    if (!user) return;
    
    // Optimistic Load: Immediately show cached data so UI is instant
    const localMarks = localStorage.getItem(`marks_${user.uid}`);
    let hasLocalData = false;
    if (localMarks) {
      try {
        setAllMarks(JSON.parse(localMarks));
        hasLocalData = true;
      } catch(e) {}
    }
    
    const localProfile = localStorage.getItem(`profile_${user.uid}`);
    if (localProfile) {
      try {
        setProfile(JSON.parse(localProfile));
        setIsFirstTime(false);
      } catch(e) {}
    }
    
    // Stop loading spinner instantly ONLY if we have local data!
    // Otherwise, wait for cloud fetch so we don't show empty data briefly.
    if (hasLocalData) {
      setLoadingData(false);
    }

    try {
      // Create a timeout promise to prevent eternal hanging
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 5000));
      
      // 1. Load Profile in background
      const profileRef = doc(db, 'users', user.uid, 'profile', 'data');
      const profilePromise = getDoc(profileRef);
      
      const profileSnap = await Promise.race([profilePromise, timeoutPromise]);
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setProfile(data);
        localStorage.setItem(`profile_${user.uid}`, JSON.stringify(data));
      } else if (!localProfile) {
        setIsFirstTime(true);
        setShowProfileModal(true);
      }

      // 2. Load all 8 semesters marks at once in background
      const q = collection(db, 'users', user.uid, 'semesters');
      const marksPromise = getDocs(q);
      const querySnapshot = await Promise.race([marksPromise, timeoutPromise]);
      
      const fetchedMarks = {};
      let firestoreLatest = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedMarks[docSnap.id] = data.marks || {};
        if (data.updatedAt) {
          const ts = new Date(data.updatedAt).getTime();
          if (ts > firestoreLatest) firestoreLatest = ts;
        }
      });
      
      const localTs = Number(localStorage.getItem(`marks_timestamp_${user.uid}`) || 0);
      
      // ONLY overwrite local state if Firestore data is explicitly newer than our local cache!
      if (!localMarks || firestoreLatest > localTs) {
        const initialMarks = {};
        for (let i = 1; i <= 8; i++) {
          initialMarks[i] = fetchedMarks[i] || {};
        }
        setAllMarks(initialMarks);
        localStorage.setItem(`marks_${user.uid}`, JSON.stringify(initialMarks));
        localStorage.setItem(`marks_timestamp_${user.uid}`, firestoreLatest.toString());
      }
    } catch (err) {
      console.error('Background fetch failed:', err);
      // Data is already loaded from localStorage optimistically, so we just log the error.
    } finally {
      // Ensure loading spinner is removed after fetch attempts
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time Firestore Sync (Cross-Device/Cross-Tab)
  useEffect(() => {
    if (!user) return;
    
    const q = collection(db, 'users', user.uid, 'semesters');
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMarks = {};
      let firestoreLatest = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedMarks[docSnap.id] = data.marks || {};
        if (data.updatedAt) {
          const ts = new Date(data.updatedAt).getTime();
          if (ts > firestoreLatest) firestoreLatest = ts;
        }
      });
      
      const localTs = Number(localStorage.getItem(`marks_timestamp_${user.uid}`) || 0);
      
      // ONLY overwrite local state if Firestore data is explicitly newer than our local cache!
      if (firestoreLatest > localTs) {
        const initialMarks = {};
        for (let i = 1; i <= 8; i++) {
          initialMarks[i] = fetchedMarks[i] || {};
        }
        setAllMarks(initialMarks);
        localStorage.setItem(`marks_${user.uid}`, JSON.stringify(initialMarks));
        localStorage.setItem(`marks_timestamp_${user.uid}`, firestoreLatest.toString());
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Background Autosave Ref
  const debounceTimer = useRef(null);

  const triggerAutosave = useCallback((newMarks) => {
    if (!user) return;
    
    // Always save instantly to local storage
    localStorage.setItem(`marks_${user.uid}`, JSON.stringify(newMarks));
    localStorage.setItem(`marks_timestamp_${user.uid}`, Date.now().toString());

    setSaveMsg('Unsaved changes...');

    // Debounce cloud sync by 1 second
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSaving(true);
      setSaveMsg('Autosaving...');
      try {
        const batch = writeBatch(db);
        const timestamp = new Date().toISOString();
        for (let sem = 1; sem <= 8; sem++) {
          const docRef = doc(db, 'users', user.uid, 'semesters', String(sem));
          batch.set(docRef, { marks: newMarks[sem], updatedAt: timestamp });
        }
        await batch.commit();
        setSaveMsg('All changes saved');
        setTimeout(() => setSaveMsg(''), 2000);
      } catch (err) {
        setSaveMsg('Autosave failed');
        setTimeout(() => setSaveMsg(''), 3000);
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, [user]);

  // Scroll Spy Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSelectedSemester(Number(entry.target.dataset.sem));
          }
        });
      },
      { rootMargin: '-40% 0px -60% 0px' }
    );

    semesterRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [loadingData]);

  // Scroll to a specific semester
  const scrollToSemester = (sem) => {
    setSelectedSemester(sem);
    const element = semesterRefs.current[sem - 1];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSidebarOpen(false);
  };

  // Update marks for a specific semester in the allMarks state
  const setMarksForSemester = (sem, updatedMarksOrFn) => {
    setAllMarks((prev) => {
      const currentSemMarks = prev[sem];
      const newSemMarks = typeof updatedMarksOrFn === 'function' 
        ? updatedMarksOrFn(currentSemMarks) 
        : updatedMarksOrFn;
      
      const newAllMarks = {
        ...prev,
        [sem]: newSemMarks
      };
      
      // Trigger autosave only on explicit user change
      triggerAutosave(newAllMarks);
      
      return newAllMarks;
    });
  };

  // Save ALL marks to Firestore
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg('');
    
    // Always save to localStorage immediately as a guaranteed backup
    localStorage.setItem(`marks_${user.uid}`, JSON.stringify(allMarks));

    try {
      const batch = writeBatch(db);
      for (let sem = 1; sem <= 8; sem++) {
        const docRef = doc(db, 'users', user.uid, 'semesters', String(sem));
        batch.set(docRef, { marks: allMarks[sem], updatedAt: new Date().toISOString() });
      }
      const savePromise = batch.commit();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 10000));
      
      await Promise.race([savePromise, timeoutPromise]);
      
      setSaveMsg('Saved successfully!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      console.error('Error saving marks:', err);
      setSaveMsg('Error saving. Please check your connection or Firestore rules.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getShortSemName = (sem) => {
    if (sem === 1) return '1st Sem';
    if (sem === 2) return '2nd Sem';
    if (sem === 3) return '3rd Sem';
    return `${sem}th Sem`;
  };

  const getInitials = (name) => {
    if (!name) return user?.email?.[0]?.toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const computeAggregate = () => {
    let totalWeightedPercent = 0;
    let totalWeightUsed = 0;
    
    for (let sem = 1; sem <= 8; sem++) {
      const weight = sem <= 4 ? 10 : 15;
      const totals = computeTotals(semesterData[sem], allMarks[sem]);
      
      if (totals.percentage !== '—') {
        const pct = parseFloat(totals.percentage);
        totalWeightedPercent += pct * weight;
        totalWeightUsed += weight;
      }
    }
    
    if (totalWeightUsed === 0) return '—';
    // If not all semesters are completed, we base the percentage out of the weight used
    return (totalWeightedPercent / totalWeightUsed).toFixed(2) + '%';
  };

  const currentSemesterData = semesterData[selectedSemester];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)}
        profile={profile}
        setProfile={(p) => {
          setProfile(p);
          setIsFirstTime(false);
        }}
        isFirstTime={isFirstTime}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 bg-white border-r border-gray-200 flex flex-col transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 ' + (sidebarCollapsed ? 'lg:w-20' : 'lg:w-64')
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className={`flex flex-col ${sidebarCollapsed ? 'hidden lg:flex lg:opacity-0 w-0' : 'opacity-100'} transition-opacity duration-200 overflow-hidden`}>
            <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap" style={{ fontFamily: "'Times New Roman', serif" }}>
              IOE Mark Tracker
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {profile?.faculty || 'BCT'} — TU
            </p>
          </div>
          
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 text-gray-500 hover:bg-gray-100 rounded-md transition"
            title="Toggle Sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <p className={`px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
            Semesters
          </p>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              onClick={() => scrollToSemester(sem)}
              title={semesterData[sem].name}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedSemester === sem
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              } ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold shrink-0 ${
                  selectedSemester === sem ? 'bg-white text-gray-900' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {sem}
              </span>
              {!sidebarCollapsed && (
                <span className="ml-3 truncate">Semester {sem}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 relative">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:block">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Times New Roman', serif" }}>
                {currentSemesterData.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* PDF Exports (Hidden on very small screens) */}
            <div className="hidden md:flex items-center gap-2 mr-2 border-r pr-4 border-gray-200">
              <button
                onClick={() => exportSemesterPDF(currentSemesterData, allMarks[selectedSemester], computeAggregate())}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition"
              >
                PDF (Current)
              </button>
              <button
                onClick={() => exportAllSemestersPDF(semesterData, allMarks, computeAggregate())}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition"
              >
                PDF (All)
              </button>
            </div>

            {/* Save Status & Button */}
            {saveMsg && (
              <span className={`hidden sm:inline text-sm font-medium ${saveMsg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loadingData}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900 text-white text-xs sm:text-sm font-medium rounded shadow-sm hover:bg-gray-800 disabled:opacity-50 transition"
            >
              <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving...' : 'Save All'}
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button 
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white shadow-sm overflow-hidden border-2 border-transparent hover:border-gray-300 transition"
              >
                {profile?.photoURL || user?.photoURL ? (
                  <img src={profile?.photoURL || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs sm:text-sm font-bold">{getInitials(profile?.name)}</span>
                )}
              </button>
              
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setShowProfileModal(true); setProfileMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      My Profile
                    </button>
                    {/* Mobile Only PDF options inside menu */}
                    <div className="md:hidden border-t border-gray-100 my-1">
                      <button
                        onClick={() => { exportSemesterPDF(currentSemesterData, allMarks[selectedSemester], computeAggregate()); setProfileMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        Export Current PDF
                      </button>
                      <button
                        onClick={() => { exportAllSemestersPDF(semesterData, allMarks, computeAggregate()); setProfileMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        Export All Semesters PDF
                      </button>
                    </div>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 lg:p-8 scroll-smooth" id="scroll-container">
          {loadingData ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-12 pb-24">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem, index) => (
                <div 
                  key={sem} 
                  data-sem={sem} 
                  ref={el => semesterRefs.current[index] = el}
                  className="scroll-mt-6 shadow-md rounded-b"
                >
                  <MarksheetTable
                    semester={semesterData[sem]}
                    marks={allMarks[sem]}
                    setMarks={(marksFn) => setMarksForSemester(sem, marksFn)}
                  />
                </div>
              ))}

              {/* Aggregate Percentage Panel */}
              <div className="scroll-mt-6 shadow-lg rounded-lg overflow-hidden border border-gray-200">
                <div className="bg-white px-6 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: "'Times New Roman', serif" }}>Overall Aggregate</h3>
                    <p className="text-sm text-gray-500 mt-1">Calculated (10% Sem 1-4, 15% Sem 5-8)</p>
                  </div>
                  <div className="mt-4 sm:mt-0 text-3xl sm:text-4xl font-black text-blue-600 tracking-tight">
                    {computeAggregate()}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
