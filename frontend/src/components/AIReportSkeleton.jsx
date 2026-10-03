import React from 'react'

export default function AIReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse py-4">
      {/* Header Skeleton */}
      <div className="bg-white/80 backdrop-blur-sm border border-orange-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2 w-2/3">
            <div className="h-7 bg-stone-200 rounded-xl w-3/4" />
            <div className="h-4 bg-stone-100 rounded-lg w-1/2" />
          </div>
          <div className="h-10 bg-amber-100/60 rounded-2xl w-36" />
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-4 bg-stone-100 rounded-lg w-full" />
          <div className="h-4 bg-stone-100 rounded-lg w-5/6" />
          <div className="h-4 bg-stone-100 rounded-lg w-4/6" />
        </div>
      </div>

      {/* Highlights & Priorities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="h-6 bg-emerald-100/60 rounded-xl w-48" />
          <div className="space-y-3">
            <div className="h-12 bg-emerald-50/50 rounded-2xl w-full" />
            <div className="h-12 bg-emerald-50/50 rounded-2xl w-full" />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="h-6 bg-amber-100/60 rounded-xl w-48" />
          <div className="space-y-3">
            <div className="h-12 bg-amber-50/50 rounded-2xl w-full" />
            <div className="h-12 bg-amber-50/50 rounded-2xl w-full" />
          </div>
        </div>
      </div>

      {/* Room Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-sm border border-stone-100 rounded-3xl p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 bg-stone-200 rounded-lg w-32" />
              <div className="h-6 bg-stone-100 rounded-full w-20" />
            </div>
            <div className="h-4 bg-stone-100 rounded-md w-full" />
            <div className="h-4 bg-stone-100 rounded-md w-4/5" />
            <div className="h-16 bg-stone-50 rounded-2xl w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}
