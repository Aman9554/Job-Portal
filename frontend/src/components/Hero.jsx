import React from 'react';

const Hero = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
        Find Government Jobs <br className="hidden md:block" /> 
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          You're 100% Eligible For
        </span>
      </h1>
      <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10">
        Stop wasting time checking notifications. Enter your details once and let our AI match you with the perfect state and central government vacancies.
      </p>
      
      <div className="max-w-3xl mx-auto bg-white/5 border border-white/10 p-2 rounded-2xl flex flex-col md:flex-row gap-2 backdrop-blur-sm">
        <input 
          type="text" 
          placeholder="Search jobs by title, department, or state..." 
          className="flex-1 bg-transparent border-none outline-none text-white px-4 py-3 placeholder-gray-500"
        />
        <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition duration-200 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          ✨ Match My Profile
        </button>
      </div>
    </div>
  );
};

export default Hero;