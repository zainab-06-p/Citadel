import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface AICreditScoreProps {
  workerAddress: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function AICreditScore({ workerAddress, size = 'md', showDetails = false }: AICreditScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isOpen, setIsOpen] = useState(showDetails);
  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCreditScore() {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/workers/${workerAddress}/credit-score`);
        if (response.ok) {
          const data = await response.json();
          setCreditData(data);
        } else {
          setCreditData(null);
        }
      } catch (error) {
        console.error('Failed to fetch credit score:', error);
        setCreditData(null);
      } finally {
        setLoading(false);
      }
    }

    if (workerAddress) {
      fetchCreditScore();
    }
  }, [workerAddress]);

  useEffect(() => {
    if (!creditData) return;
    // Reveal animation
    const duration = 1500; // ms
    const incrementTime = 30;
    const steps = duration / incrementTime;
    const scoreStep = creditData.score / steps;
    
    let currentScore = 0;
    const timer = setInterval(() => {
      currentScore += scoreStep;
      if (currentScore >= creditData.score) {
        currentScore = creditData.score;
        clearInterval(timer);
      }
      setAnimatedScore(Math.round(currentScore));
    }, incrementTime);
    
    return () => clearInterval(timer);
  }, [creditData]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-white/5 mx-auto max-w-sm w-full flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!creditData) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-white/5 mx-auto max-w-sm w-full flex items-center justify-center min-h-[300px]">
         <p className="text-slate-600">Failed to load credit score.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden backdrop-blur-2xl bg-indigo-950/20 max-w-sm w-full mx-auto"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <h1 className="text-8xl font-black">{creditData.score}</h1>
      </div>

      <div className="flex items-center justify-between mb-8 z-10 relative">
        <h3 className="text-lg font-semibold text-slate-900 tracking-wide">🤖 AI Credit Score</h3>
      </div>

      <div className="flex flex-col items-center justify-center relative z-10">
        <div className="w-36 h-36 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          <CircularProgressbar
            value={animatedScore}
            maxValue={100}
            text={`${animatedScore}`}
            strokeWidth={8}
            styles={buildStyles({
              pathColor: creditData.riskColor,
              textColor: '#f8fafc',
              trailColor: 'rgba(255,255,255,0.05)',
              pathTransitionDuration: 0.1,
              textSize: '24px'
            })}
          />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: animatedScore === creditData.score ? 1 : 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium text-sm flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Risk Category: {creditData.riskCategory}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: animatedScore === creditData.score ? 1 : 0, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="w-full bg-white/5 rounded-xl p-4 border border-white/5 shadow-inner"
        >
          <div className="flex justify-between items-end mb-2">
            <span className="text-slate-600 text-sm">Eligible Loan</span>
            <span className="text-xl font-bold text-emerald-400">â‚¹{creditData.loanEligibility.maxAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Interest: {creditData.loanEligibility.interestRate}% p.a.</span>
            <span>EMI: â‚¹{creditData.loanEligibility.emi} / {creditData.loanEligibility.tenure}mo</span>
          </div>
        </motion.div>
        
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="mt-6 text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
        >
          {isOpen ? 'Hide Breakdown' : 'View Breakdown'}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Breakdown Panel */}
        <motion.div
           initial={{ height: 0, opacity: 0 }}
           animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
           className="w-full overflow-hidden"
        >
          <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
            <FactorRow label="Completed Contracts" val={creditData.factors.completedContracts.value} score={creditData.factors.completedContracts.normalizedScore} />
            <FactorRow label="On-Time Rate" val={creditData.factors.onTimeCompletionRate.value} score={creditData.factors.onTimeCompletionRate.normalizedScore} />
            <FactorRow label="Payment Reliability" val={creditData.factors.paymentReliability.value} score={creditData.factors.paymentReliability.normalizedScore} />
            <FactorRow label="History Duration" val={creditData.factors.contractDuration.value} score={creditData.factors.contractDuration.normalizedScore} />
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}

function FactorRow({ label, val, score }: { label: string, val: string | number, score: number }) {
  return (
    <div className="flex flex-col gap-1 w-full text-sm">
      <div className="flex justify-between text-slate-700">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{val}</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
         <motion.div 
           initial={{ width: 0 }} animate={{ width: `${score}%` }} 
           className="h-full bg-blue-500 rounded-full" 
           transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
         />
      </div>
    </div>
  );
}
