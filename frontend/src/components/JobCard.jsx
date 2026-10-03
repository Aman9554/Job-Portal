import React from 'react';

const JobCard = () => {
  return (
    <div className="max-w-sm w-full backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl hover:bg-white/10 transition duration-300">
      
      {/* Top Row: Logo & Badge */}
      <div className="flex justify-between items-center mb-4">
        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
          UP
        </div>
        <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
          🔥 2 Days Left
        </span>
      </div>

      {/* Middle Row: Title & Dept */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white mb-1">UPPSC RO/ARO 2026</h2>
        <p className="text-sm text-gray-400">Uttar Pradesh Public Service Commission</p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="bg-gray-800/50 text-gray-300 text-xs px-2 py-1 rounded-md">🎓 Graduation</span>
        <span className="bg-gray-800/50 text-gray-300 text-xs px-2 py-1 rounded-md">🎂 21-40 Yrs</span>
        <span className="bg-gray-800/50 text-gray-300 text-xs px-2 py-1 rounded-md">💰 ₹125 Fee</span>
      </div>

      {/* Action Button */}
      <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition duration-200">
        View Details & Apply
      </button>

    </div>
  );
};

export default JobCard;