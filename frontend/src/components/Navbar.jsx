import React from 'react';

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-[#0F172A]/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              G
            </div>
            <span className="text-xl font-bold text-white tracking-wide">GovJob<span className="text-blue-500">.AI</span></span>
          </div>
          <div className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-300 hover:text-white transition">Home</a>
            <a href="#" className="text-gray-300 hover:text-white transition">Jobs</a>
            <a href="#" className="text-gray-300 hover:text-white transition">Syllabus Tracker</a>
          </div>
          <div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition border border-white/10">
              Login
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;