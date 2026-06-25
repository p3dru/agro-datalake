"use client";
import React, { useState } from 'react';

export default function TooltipBox({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="relative inline-flex items-center justify-center ml-3 cursor-pointer align-middle"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="bg-[#ccff00] text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-black border-4 border-black hover:bg-black hover:text-[#ccff00] transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
        ?
      </span>
      {show && (
        <div className="absolute top-10 left-0 md:left-auto md:-translate-x-1/2 z-50 w-72 p-4 bg-white border-4 border-black text-black text-sm font-bold shadow-[6px_6px_0px_rgba(0,0,0,1)]">
          {text}
        </div>
      )}
    </div>
  );
}
