import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PlanStep {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  codeSnippet?: string
  filePath?: string
  order: number
}

export interface CodingPlan {
  id: string
  title: string
  description?: string
  steps: PlanStep[]
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface PlanState {
  plans: CodingPlan[]
  activePlanId: string | null
  isPlanningMode: boolean
  
  // Actions
  createPlan: (title: string, description?: string) => string
  deletePlan: (id: string) => void
  setActivePlan: (id: string | null) => void
  addStep: (planId: string, step: Omit<PlanStep, 'id' | 'order'>) => void
  updateStep: (planId: string, stepId: string, updates: Partial<PlanStep>) => void
  deleteStep: (planId: string, stepId: string) => void
  reorderSteps: (planId: string, stepIds: string[]) => void
  togglePlanningMode: () => void
  setPlanningMode: (value: boolean) => void
  generatePlanFromAI: (title: string, description: string, steps: Array<{title: string, description?: string}>) => string
  getActivePlan: () => CodingPlan | null
  getProgress: (planId: string) => { total: number; completed: number; percentage: number }
  resetPlanProgress: (planId: string) => void
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plans: [],
      activePlanId: null,
      isPlanningMode: false,

      createPlan: (title, description) => {
        const id = `plan_${Date.now()}`
        const newPlan: CodingPlan = {
          id,
          title,
          description,
          steps: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        }
        set(state => ({
          plans: [...state.plans, newPlan],
          activePlanId: id
        }))
        return id
      },

      deletePlan: (id) => {
        set(state => ({
          plans: state.plans.filter(p => p.id !== id),
          activePlanId: state.activePlanId === id ? null : state.activePlanId
        }))
      },

      setActivePlan: (id) => {
        set({ activePlanId: id })
      },

      addStep: (planId, step) => {
        set(state => ({
          plans: state.plans.map(plan => {
            if (plan.id !== planId) return plan
            const newStep: PlanStep = {
              ...step,
              id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              order: plan.steps.length
            }
            return {
              ...plan,
              steps: [...plan.steps, newStep],
              updatedAt: new Date()
            }
          })
        }))
      },

      updateStep: (planId, stepId, updates) => {
        set(state => ({
          plans: state.plans.map(plan => {
            if (plan.id !== planId) return plan
            return {
              ...plan,
              steps: plan.steps.map(step =>
                step.id === stepId ? { ...step, ...updates } : step
              ),
              updatedAt: new Date()
            }
          })
        }))
      },

      deleteStep: (planId, stepId) => {
        set(state => ({
          plans: state.plans.map(plan => {
            if (plan.id !== planId) return plan
            return {
              ...plan,
              steps: plan.steps.filter(s => s.id !== stepId),
              updatedAt: new Date()
            }
          })
        }))
      },

      reorderSteps: (planId, stepIds) => {
        set(state => ({
          plans: state.plans.map(plan => {
            if (plan.id !== planId) return plan
            const stepMap = new Map(plan.steps.map(s => [s.id, s]))
            return {
              ...plan,
              steps: stepIds.map((id, index) => ({
                ...stepMap.get(id)!,
                order: index
              })),
              updatedAt: new Date()
            }
          })
        }))
      },

      togglePlanningMode: () => {
        set(state => ({ isPlanningMode: !state.isPlanningMode }))
      },

      setPlanningMode: (value) => {
        set({ isPlanningMode: value })
      },

      generatePlanFromAI: (title, description, steps) => {
        const id = `plan_${Date.now()}`
        const newPlan: CodingPlan = {
          id,
          title,
          description,
          steps: steps.map((s, index) => ({
            id: `step_${Date.now()}_${index}`,
            title: s.title,
            description: s.description,
            status: 'pending',
            order: index
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        }
        set(state => ({
          plans: [...state.plans, newPlan],
          activePlanId: id
        }))
        return id
      },

      getActivePlan: () => {
        const { plans, activePlanId } = get()
        return plans.find(p => p.id === activePlanId) || null
      },

      getProgress: (planId) => {
        const plan = get().plans.find(p => p.id === planId)
        if (!plan) return { total: 0, completed: 0, percentage: 0 }
        const total = plan.steps.length
        const completed = plan.steps.filter(s => s.status === 'completed').length
        return {
          total,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        }
      },

      resetPlanProgress: (planId) => {
        set(state => ({
          plans: state.plans.map(plan => {
            if (plan.id !== planId) return plan
            return {
              ...plan,
              steps: plan.steps.map(step => ({
                ...step,
                status: 'pending' as const
              })),
              updatedAt: new Date()
            }
          })
        }))
      }
    }),
    {
      name: 'oran-note-plans',
      version: 1
    }
  )
)
