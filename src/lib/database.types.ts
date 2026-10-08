
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "company_size": Database["public"]['Enums']["company_size"] | null,"created_at": string,"department_code": string | null,"frequency": Database["public"]['Enums']["alert_frequency"],"id": string,"include_external": boolean,"is_active": boolean,"keywords": string | null,"last_sent_at": string | null,"name": string,"place_slug": string | null,"radius_km": number | null,"region": string | null,"sector_slug": string | null,"skills": (string)[],"type": Database["public"]['Enums']["opportunity_type"] | null,"unsubscribe_token": string,"user_id": string
                  }
                  Insert: {
                    "company_size"?: Database["public"]['Enums']["company_size"] | null,"created_at"?: string,"department_code"?: string | null,"frequency"?: Database["public"]['Enums']["alert_frequency"],"id"?: string,"include_external"?: boolean,"is_active"?: boolean,"keywords"?: string | null,"last_sent_at"?: string | null,"name": string,"place_slug"?: string | null,"radius_km"?: number | null,"region"?: string | null,"sector_slug"?: string | null,"skills"?: (string)[],"type"?: Database["public"]['Enums']["opportunity_type"] | null,"unsubscribe_token"?: string,"user_id": string
                  }
                  Update: {
                    "company_size"?: Database["public"]['Enums']["company_size"] | null,"created_at"?: string,"department_code"?: string | null,"frequency"?: Database["public"]['Enums']["alert_frequency"],"id"?: string,"include_external"?: boolean,"is_active"?: boolean,"keywords"?: string | null,"last_sent_at"?: string | null,"name"?: string,"place_slug"?: string | null,"radius_km"?: number | null,"region"?: string | null,"sector_slug"?: string | null,"skills"?: (string)[],"type"?: Database["public"]['Enums']["opportunity_type"] | null,"unsubscribe_token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "alerts_place_slug_fkey"
      columns: ["place_slug"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "alerts_sector_slug_fkey"
      columns: ["sector_slug"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "company_id": string | null,"created_at": string,"event_name": string,"id": number,"properties": NonNullable<Json>,"user_id": string | null
                  }
                  Insert: {
                    "company_id"?: string | null,"created_at"?: string,"event_name": string,"id"?: never,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "company_id"?: string | null,"created_at"?: string,"event_name"?: string,"id"?: never,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "analytics_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"articles": {
                  Row: {
                    "body": NonNullable<Json>,"created_at": string,"description": string,"facts": NonNullable<Json>,"id": string,"model": string | null,"published_at": string | null,"slug": string,"status": string,"title": string,"topic_key": string,"updated_at": string,"validation_note": string | null
                  }
                  Insert: {
                    "body": NonNullable<Json>,"created_at"?: string,"description": string,"facts": NonNullable<Json>,"id"?: string,"model"?: string | null,"published_at"?: string | null,"slug": string,"status"?: string,"title": string,"topic_key": string,"updated_at"?: string,"validation_note"?: string | null
                  }
                  Update: {
                    "body"?: NonNullable<Json>,"created_at"?: string,"description"?: string,"facts"?: NonNullable<Json>,"id"?: string,"model"?: string | null,"published_at"?: string | null,"slug"?: string,"status"?: string,"title"?: string,"topic_key"?: string,"updated_at"?: string,"validation_note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>
                  }
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_user_id_fkey"
      columns: ["actor_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_events": {
                  Row: {
                    "company_id": string | null,"processed_at": string,"stripe_event_id": string,"summary": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "company_id"?: string | null,"processed_at"?: string,"stripe_event_id": string,"summary"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "company_id"?: string | null,"processed_at"?: string,"stripe_event_id"?: string,"summary"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_events_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "city": string | null,"created_at": string,"created_by": string | null,"department_code": string | null,"id": string,"is_demo": boolean,"kind": Database["public"]['Enums']["company_kind"],"lat": number | null,"lng": number | null,"logo_path": string | null,"name": string,"plan_code": string,"postal_code": string | null,"region": string | null,"siren": string | null,"size": Database["public"]['Enums']["company_size"] | null,"slug": string,"status": Database["public"]['Enums']["company_status"],"stripe_customer_id": string | null,"updated_at": string,"verification_note": string | null,"verified_at": string | null,"verified_by": string | null,"website": string | null
                  }
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: Database["public"]['Enums']["company_kind"],"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"name": string,"plan_code"?: string,"postal_code"?: string | null,"region"?: string | null,"siren"?: string | null,"size"?: Database["public"]['Enums']["company_size"] | null,"slug": string,"status"?: Database["public"]['Enums']["company_status"],"stripe_customer_id"?: string | null,"updated_at"?: string,"verification_note"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"id"?: string,"is_demo"?: boolean,"kind"?: Database["public"]['Enums']["company_kind"],"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"name"?: string,"plan_code"?: string,"postal_code"?: string | null,"region"?: string | null,"siren"?: string | null,"size"?: Database["public"]['Enums']["company_size"] | null,"slug"?: string,"status"?: Database["public"]['Enums']["company_status"],"stripe_customer_id"?: string | null,"updated_at"?: string,"verification_note"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "companies_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "companies_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "companies_verified_by_fk"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_invitations": {
                  Row: {
                    "accepted_at": string | null,"company_id": string,"created_at": string,"email": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["company_role"]
                  }
                  Insert: {
                    "accepted_at"?: string | null,"company_id": string,"created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["company_role"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"company_id"?: string,"created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["company_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_invitations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_members": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"role": Database["public"]['Enums']["company_role"],"user_id": string
                  }
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["company_role"],"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["company_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_members_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_profiles": {
                  Row: {
                    "certifications": (string)[],"company_id": string,"contact_email": string | null,"contact_phone": string | null,"description": string | null,"employees_range": string | null,"founded_year": number | null,"intervention_radius_km": number | null,"intervention_zone": string | null,"is_public": boolean,"references_text": string | null,"search_vector": unknown,"sectors": (string)[],"skills": (string)[],"tagline": string | null,"updated_at": string
                  }
                  Insert: {
                    "certifications"?: (string)[],"company_id": string,"contact_email"?: string | null,"contact_phone"?: string | null,"description"?: string | null,"employees_range"?: string | null,"founded_year"?: number | null,"intervention_radius_km"?: number | null,"intervention_zone"?: string | null,"is_public"?: boolean,"references_text"?: string | null,"search_vector"?: unknown,"sectors"?: (string)[],"skills"?: (string)[],"tagline"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "certifications"?: (string)[],"company_id"?: string,"contact_email"?: string | null,"contact_phone"?: string | null,"description"?: string | null,"employees_range"?: string | null,"founded_year"?: number | null,"intervention_radius_km"?: number | null,"intervention_zone"?: string | null,"is_public"?: boolean,"references_text"?: string | null,"search_vector"?: unknown,"sectors"?: (string)[],"skills"?: (string)[],"tagline"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_profiles_company_id_fkey"
      columns: ["company_id"]
isOneToOne: true
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "company": string | null,"created_at": string,"email": string,"handled": boolean,"id": string,"message": string,"name": string,"subject": string
                  }
                  Insert: {
                    "company"?: string | null,"created_at"?: string,"email": string,"handled"?: boolean,"id"?: string,"message": string,"name": string,"subject": string
                  }
                  Update: {
                    "company"?: string | null,"created_at"?: string,"email"?: string,"handled"?: boolean,"id"?: string,"message"?: string,"name"?: string,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "buyer_company_id": string,"created_at": string,"created_by": string | null,"id": string,"last_message_at": string,"opportunity_id": string | null,"subject": string | null,"supplier_company_id": string
                  }
                  Insert: {
                    "buyer_company_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string,"opportunity_id"?: string | null,"subject"?: string | null,"supplier_company_id": string
                  }
                  Update: {
                    "buyer_company_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string,"opportunity_id"?: string | null,"subject"?: string | null,"supplier_company_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_company_id_fkey"
      columns: ["buyer_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_supplier_company_id_fkey"
      columns: ["supplier_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_reports": {
                  Row: {
                    "day": string,"error": string | null,"facts": NonNullable<Json>,"generated_at": string,"model": string | null,"note": string | null,"summary": Json | null
                  }
                  Insert: {
                    "day": string,"error"?: string | null,"facts": NonNullable<Json>,"generated_at"?: string,"model"?: string | null,"note"?: string | null,"summary"?: Json | null
                  }
                  Update: {
                    "day"?: string,"error"?: string | null,"facts"?: NonNullable<Json>,"generated_at"?: string,"model"?: string | null,"note"?: string | null,"summary"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "code": string,"name": string,"nuts3": string | null,"region": string,"slug": string
                  }
                  Insert: {
                    "code": string,"name": string,"nuts3"?: string | null,"region": string,"slug": string
                  }
                  Update: {
                    "code"?: string,"name"?: string,"nuts3"?: string | null,"region"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"email_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"sent_at": string | null,"status": Database["public"]['Enums']["email_status"],"subject": string,"template": string,"to_email": string,"user_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["email_status"],"subject": string,"template": string,"to_email": string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["email_status"],"subject"?: string,"template"?: string,"to_email"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"external_sources": {
                  Row: {
                    "attribution": string | null,"base_url": string | null,"code": string | null,"config": NonNullable<Json>,"connector": string,"created_at": string,"description": string | null,"id": string,"import_method": string,"is_active": boolean,"is_demo": boolean,"last_error": string | null,"last_success_at": string | null,"last_sync_at": string | null,"legal_validated_at": string | null,"legal_validated_by": string | null,"license": string | null,"name": string,"next_sync_at": string | null,"notes": string | null,"status": Database["public"]['Enums']["source_status"],"sync_frequency": string,"terms_url": string | null,"updated_at": string
                  }
                  Insert: {
                    "attribution"?: string | null,"base_url"?: string | null,"code"?: string | null,"config"?: NonNullable<Json>,"connector"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"import_method"?: string,"is_active"?: boolean,"is_demo"?: boolean,"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"legal_validated_at"?: string | null,"legal_validated_by"?: string | null,"license"?: string | null,"name": string,"next_sync_at"?: string | null,"notes"?: string | null,"status"?: Database["public"]['Enums']["source_status"],"sync_frequency"?: string,"terms_url"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attribution"?: string | null,"base_url"?: string | null,"code"?: string | null,"config"?: NonNullable<Json>,"connector"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"import_method"?: string,"is_active"?: boolean,"is_demo"?: boolean,"last_error"?: string | null,"last_success_at"?: string | null,"last_sync_at"?: string | null,"legal_validated_at"?: string | null,"legal_validated_by"?: string | null,"license"?: string | null,"name"?: string,"next_sync_at"?: string | null,"notes"?: string | null,"status"?: Database["public"]['Enums']["source_status"],"sync_frequency"?: string,"terms_url"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_sources_legal_validated_by_fkey"
      columns: ["legal_validated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "company_id": string | null,"created_at": string,"id": string,"opportunity_id": string | null,"user_id": string
                  }
                  Insert: {
                    "company_id"?: string | null,"created_at"?: string,"id"?: string,"opportunity_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "company_id"?: string | null,"created_at"?: string,"id"?: string,"opportunity_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"interests": {
                  Row: {
                    "buyer_note": string | null,"company_id": string,"created_at": string,"id": string,"message": string | null,"opportunity_id": string,"status": Database["public"]['Enums']["interest_status"],"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "buyer_note"?: string | null,"company_id": string,"created_at"?: string,"id"?: string,"message"?: string | null,"opportunity_id": string,"status"?: Database["public"]['Enums']["interest_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "buyer_note"?: string | null,"company_id"?: string,"created_at"?: string,"id"?: string,"message"?: string | null,"opportunity_id"?: string,"status"?: Database["public"]['Enums']["interest_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "interests_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interests_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_due_cents": number,"amount_paid_cents": number,"company_id": string,"created_at": string,"currency": string,"hosted_invoice_url": string | null,"id": string,"invoice_pdf": string | null,"number": string | null,"period_end": string | null,"period_start": string | null,"status": string,"stripe_invoice_id": string,"stripe_subscription_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_due_cents"?: number,"amount_paid_cents"?: number,"company_id": string,"created_at"?: string,"currency"?: string,"hosted_invoice_url"?: string | null,"id"?: string,"invoice_pdf"?: string | null,"number"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status": string,"stripe_invoice_id": string,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_due_cents"?: number,"amount_paid_cents"?: number,"company_id"?: string,"created_at"?: string,"currency"?: string,"hosted_invoice_url"?: string | null,"id"?: string,"invoice_pdf"?: string | null,"number"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: string,"stripe_invoice_id"?: string,"stripe_subscription_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_path": string | null,"body": string,"conversation_id": string,"created_at": string,"id": string,"read_at": string | null,"sender_company_id": string,"sender_user_id": string | null
                  }
                  Insert: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_company_id": string,"sender_user_id"?: string | null
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_company_id"?: string,"sender_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_company_id_fkey"
      columns: ["sender_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_user_id_fkey"
      columns: ["sender_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"created_at": string,"id": string,"moderator_id": string | null,"reason": string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"reason"?: string | null,"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action_type"],"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"reason"?: string | null,"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "budget_max": number | null,"budget_min": number | null,"budget_visible": boolean,"city": string | null,"closed_at": string | null,"company_id": string | null,"constraints": string | null,"contact_name": string | null,"cpv_codes": (string)[],"created_at": string,"created_by": string | null,"criteria": string | null,"dedup_key": string | null,"department_code": string | null,"description": string,"duplicate_of": string | null,"external_buyer_name": string | null,"external_reference": string | null,"id": string,"is_demo": boolean,"keywords": (string)[],"lat": number | null,"lng": number | null,"max_suppliers": number | null,"moderation_note": string | null,"origin": Database["public"]['Enums']["opportunity_origin"],"outcome": Database["public"]['Enums']["opportunity_outcome"] | null,"outcome_note": string | null,"postal_code": string | null,"published_at": string | null,"publisher_attested_at": string | null,"region": string | null,"response_deadline": string | null,"search_vector": unknown,"sector_slug": string | null,"selected_proposal_id": string | null,"services": string | null,"skills": (string)[],"start_date": string | null,"status": Database["public"]['Enums']["opportunity_status"],"summary": string | null,"target_company_size": Database["public"]['Enums']["company_size"] | null,"title": string,"type": Database["public"]['Enums']["opportunity_type"],"updated_at": string,"visibility": Database["public"]['Enums']["opportunity_visibility"]
                  }
                  Insert: {
                    "budget_max"?: number | null,"budget_min"?: number | null,"budget_visible"?: boolean,"city"?: string | null,"closed_at"?: string | null,"company_id"?: string | null,"constraints"?: string | null,"contact_name"?: string | null,"cpv_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"criteria"?: string | null,"dedup_key"?: string | null,"department_code"?: string | null,"description": string,"duplicate_of"?: string | null,"external_buyer_name"?: string | null,"external_reference"?: string | null,"id"?: string,"is_demo"?: boolean,"keywords"?: (string)[],"lat"?: number | null,"lng"?: number | null,"max_suppliers"?: number | null,"moderation_note"?: string | null,"origin"?: Database["public"]['Enums']["opportunity_origin"],"outcome"?: Database["public"]['Enums']["opportunity_outcome"] | null,"outcome_note"?: string | null,"postal_code"?: string | null,"published_at"?: string | null,"publisher_attested_at"?: string | null,"region"?: string | null,"response_deadline"?: string | null,"search_vector"?: unknown,"sector_slug"?: string | null,"selected_proposal_id"?: string | null,"services"?: string | null,"skills"?: (string)[],"start_date"?: string | null,"status"?: Database["public"]['Enums']["opportunity_status"],"summary"?: string | null,"target_company_size"?: Database["public"]['Enums']["company_size"] | null,"title": string,"type": Database["public"]['Enums']["opportunity_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["opportunity_visibility"]
                  }
                  Update: {
                    "budget_max"?: number | null,"budget_min"?: number | null,"budget_visible"?: boolean,"city"?: string | null,"closed_at"?: string | null,"company_id"?: string | null,"constraints"?: string | null,"contact_name"?: string | null,"cpv_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"criteria"?: string | null,"dedup_key"?: string | null,"department_code"?: string | null,"description"?: string,"duplicate_of"?: string | null,"external_buyer_name"?: string | null,"external_reference"?: string | null,"id"?: string,"is_demo"?: boolean,"keywords"?: (string)[],"lat"?: number | null,"lng"?: number | null,"max_suppliers"?: number | null,"moderation_note"?: string | null,"origin"?: Database["public"]['Enums']["opportunity_origin"],"outcome"?: Database["public"]['Enums']["opportunity_outcome"] | null,"outcome_note"?: string | null,"postal_code"?: string | null,"published_at"?: string | null,"publisher_attested_at"?: string | null,"region"?: string | null,"response_deadline"?: string | null,"search_vector"?: unknown,"sector_slug"?: string | null,"selected_proposal_id"?: string | null,"services"?: string | null,"skills"?: (string)[],"start_date"?: string | null,"status"?: Database["public"]['Enums']["opportunity_status"],"summary"?: string | null,"target_company_size"?: Database["public"]['Enums']["company_size"] | null,"title"?: string,"type"?: Database["public"]['Enums']["opportunity_type"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["opportunity_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "opportunities_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_sector_slug_fkey"
      columns: ["sector_slug"]
isOneToOne: false
      referencedRelation: "sectors"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "opportunities_selected_proposal_fk"
      columns: ["selected_proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_type_fkey"
      columns: ["type"]
isOneToOne: false
      referencedRelation: "opportunity_types"
      referencedColumns: ["code"]
    }
                  ]
                },"opportunity_documents": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"mime_type": string,"opportunity_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"mime_type": string,"opportunity_id": string,"size_bytes": number,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"opportunity_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_documents_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunity_sources": {
                  Row: {
                    "content_hash": string | null,"external_id": string | null,"imported_at": string,"imported_by": string | null,"is_primary": boolean,"last_verified_at": string | null,"opportunity_id": string,"original_url": string,"source_id": string,"source_published_at": string | null,"source_updated_at": string | null,"verification_status": string
                  }
                  Insert: {
                    "content_hash"?: string | null,"external_id"?: string | null,"imported_at"?: string,"imported_by"?: string | null,"is_primary"?: boolean,"last_verified_at"?: string | null,"opportunity_id": string,"original_url": string,"source_id": string,"source_published_at"?: string | null,"source_updated_at"?: string | null,"verification_status"?: string
                  }
                  Update: {
                    "content_hash"?: string | null,"external_id"?: string | null,"imported_at"?: string,"imported_by"?: string | null,"is_primary"?: boolean,"last_verified_at"?: string | null,"opportunity_id"?: string,"original_url"?: string,"source_id"?: string,"source_published_at"?: string | null,"source_updated_at"?: string | null,"verification_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_sources_imported_by_fkey"
      columns: ["imported_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_sources_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_sources_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "external_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunity_types": {
                  Row: {
                    "accepts_proposals": boolean,"code": Database["public"]['Enums']["opportunity_type"],"description": string,"is_external": boolean,"label": string,"sort_order": number
                  }
                  Insert: {
                    "accepts_proposals"?: boolean,"code": Database["public"]['Enums']["opportunity_type"],"description": string,"is_external"?: boolean,"label": string,"sort_order"?: number
                  }
                  Update: {
                    "accepts_proposals"?: boolean,"code"?: Database["public"]['Enums']["opportunity_type"],"description"?: string,"is_external"?: boolean,"label"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"outreach_campaigns": {
                  Row: {
                    "campaign_date": string,"created_at": string,"dry_run": boolean,"error": string | null,"id": string,"intro_template": string,"kind": string,"launched_by": string | null,"min_score": number,"report": string | null,"sent_at": string | null,"stats": NonNullable<Json>,"status": string,"subject_template": string,"updated_at": string,"validated_at": string | null,"validated_by": string | null
                  }
                  Insert: {
                    "campaign_date": string,"created_at"?: string,"dry_run"?: boolean,"error"?: string | null,"id"?: string,"intro_template": string,"kind"?: string,"launched_by"?: string | null,"min_score": number,"report"?: string | null,"sent_at"?: string | null,"stats"?: NonNullable<Json>,"status"?: string,"subject_template": string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Update: {
                    "campaign_date"?: string,"created_at"?: string,"dry_run"?: boolean,"error"?: string | null,"id"?: string,"intro_template"?: string,"kind"?: string,"launched_by"?: string | null,"min_score"?: number,"report"?: string | null,"sent_at"?: string | null,"stats"?: NonNullable<Json>,"status"?: string,"subject_template"?: string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_campaigns_launched_by_fkey"
      columns: ["launched_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_campaigns_validated_by_fkey"
      columns: ["validated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_discovery_runs": {
                  Row: {
                    "department_code": string,"error": string | null,"fetched": number,"id": string,"naf_code": string,"ran_at": string
                  }
                  Insert: {
                    "department_code": string,"error"?: string | null,"fetched"?: number,"id"?: string,"naf_code": string,"ran_at"?: string
                  }
                  Update: {
                    "department_code"?: string,"error"?: string | null,"fetched"?: number,"id"?: string,"naf_code"?: string,"ran_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"outreach_events": {
                  Row: {
                    "campaign_id": string | null,"created_at": string,"id": number,"meta": NonNullable<Json>,"opportunity_id": string | null,"recipient_id": string | null,"type": string,"user_id": string | null
                  }
                  Insert: {
                    "campaign_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"opportunity_id"?: string | null,"recipient_id"?: string | null,"type": string,"user_id"?: string | null
                  }
                  Update: {
                    "campaign_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"opportunity_id"?: string | null,"recipient_id"?: string | null,"type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_events_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "outreach_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_events_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_events_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "outreach_recipients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_opportunity_states": {
                  Row: {
                    "content_hash": string,"first_seen_at": string,"last_campaign_id": string | null,"matches_count": number,"opportunity_id": string,"processed_at": string | null,"status": string,"target_naf": (string)[],"target_profiles": (string)[],"updated_at": string
                  }
                  Insert: {
                    "content_hash": string,"first_seen_at"?: string,"last_campaign_id"?: string | null,"matches_count"?: number,"opportunity_id": string,"processed_at"?: string | null,"status"?: string,"target_naf"?: (string)[],"target_profiles"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "content_hash"?: string,"first_seen_at"?: string,"last_campaign_id"?: string | null,"matches_count"?: number,"opportunity_id"?: string,"processed_at"?: string | null,"status"?: string,"target_naf"?: (string)[],"target_profiles"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_opportunity_states_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: true
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_prospects": {
                  Row: {
                    "activity": string | null,"city": string | null,"contact_name": string | null,"contacts_count": number,"created_at": string,"department_code": string | null,"email": string | null,"email_source": string | null,"enriched_at": string | null,"enrichment_note": string | null,"enrichment_status": string,"excluded_reason": string | null,"id": string,"intervention_zone": string,"is_individual_entrepreneur": boolean,"keywords": (string)[],"last_clicked_at": string | null,"last_contacted_at": string | null,"legal_basis": string,"linkprob2b_company_id": string | null,"naf_code": string | null,"naf_label": string | null,"name": string,"postal_code": string | null,"refreshed_at": string,"region": string | null,"sectors": (string)[],"services": (string)[],"siren": string | null,"siret": string | null,"size_range": string | null,"source": string,"source_ref": string | null,"status": string,"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "activity"?: string | null,"city"?: string | null,"contact_name"?: string | null,"contacts_count"?: number,"created_at"?: string,"department_code"?: string | null,"email"?: string | null,"email_source"?: string | null,"enriched_at"?: string | null,"enrichment_note"?: string | null,"enrichment_status"?: string,"excluded_reason"?: string | null,"id"?: string,"intervention_zone"?: string,"is_individual_entrepreneur"?: boolean,"keywords"?: (string)[],"last_clicked_at"?: string | null,"last_contacted_at"?: string | null,"legal_basis"?: string,"linkprob2b_company_id"?: string | null,"naf_code"?: string | null,"naf_label"?: string | null,"name": string,"postal_code"?: string | null,"refreshed_at"?: string,"region"?: string | null,"sectors"?: (string)[],"services"?: (string)[],"siren"?: string | null,"siret"?: string | null,"size_range"?: string | null,"source": string,"source_ref"?: string | null,"status"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "activity"?: string | null,"city"?: string | null,"contact_name"?: string | null,"contacts_count"?: number,"created_at"?: string,"department_code"?: string | null,"email"?: string | null,"email_source"?: string | null,"enriched_at"?: string | null,"enrichment_note"?: string | null,"enrichment_status"?: string,"excluded_reason"?: string | null,"id"?: string,"intervention_zone"?: string,"is_individual_entrepreneur"?: boolean,"keywords"?: (string)[],"last_clicked_at"?: string | null,"last_contacted_at"?: string | null,"legal_basis"?: string,"linkprob2b_company_id"?: string | null,"naf_code"?: string | null,"naf_label"?: string | null,"name"?: string,"postal_code"?: string | null,"refreshed_at"?: string,"region"?: string | null,"sectors"?: (string)[],"services"?: (string)[],"siren"?: string | null,"siret"?: string | null,"size_range"?: string | null,"source"?: string,"source_ref"?: string | null,"status"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_prospects_linkprob2b_company_id_fkey"
      columns: ["linkprob2b_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_recipient_opportunities": {
                  Row: {
                    "excluded": boolean,"opportunity_id": string,"position": number,"reasons": (string)[],"recipient_id": string,"score": number
                  }
                  Insert: {
                    "excluded"?: boolean,"opportunity_id": string,"position"?: number,"reasons"?: (string)[],"recipient_id": string,"score": number
                  }
                  Update: {
                    "excluded"?: boolean,"opportunity_id"?: string,"position"?: number,"reasons"?: (string)[],"recipient_id"?: string,"score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_recipient_opportunities_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_recipient_opportunities_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "outreach_recipients"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_recipients": {
                  Row: {
                    "campaign_id": string,"clicked_at": string | null,"converted_at": string | null,"created_at": string,"email": string | null,"error": string | null,"gate_viewed_at": string | null,"id": string,"intro": string | null,"landing_viewed_at": string | null,"logged_in_at": string | null,"login_clicked_at": string | null,"offer_accessed_at": string | null,"opened_at": string | null,"opportunity_viewed_at": string | null,"prospect_id": string,"provider_id": string | null,"reasons": (string)[],"score": number,"sent_at": string | null,"signed_up_at": string | null,"signup_clicked_at": string | null,"status": string,"subject": string | null,"unsubscribed_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "campaign_id": string,"clicked_at"?: string | null,"converted_at"?: string | null,"created_at"?: string,"email"?: string | null,"error"?: string | null,"gate_viewed_at"?: string | null,"id"?: string,"intro"?: string | null,"landing_viewed_at"?: string | null,"logged_in_at"?: string | null,"login_clicked_at"?: string | null,"offer_accessed_at"?: string | null,"opened_at"?: string | null,"opportunity_viewed_at"?: string | null,"prospect_id": string,"provider_id"?: string | null,"reasons"?: (string)[],"score": number,"sent_at"?: string | null,"signed_up_at"?: string | null,"signup_clicked_at"?: string | null,"status"?: string,"subject"?: string | null,"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "campaign_id"?: string,"clicked_at"?: string | null,"converted_at"?: string | null,"created_at"?: string,"email"?: string | null,"error"?: string | null,"gate_viewed_at"?: string | null,"id"?: string,"intro"?: string | null,"landing_viewed_at"?: string | null,"logged_in_at"?: string | null,"login_clicked_at"?: string | null,"offer_accessed_at"?: string | null,"opened_at"?: string | null,"opportunity_viewed_at"?: string | null,"prospect_id"?: string,"provider_id"?: string | null,"reasons"?: (string)[],"score"?: number,"sent_at"?: string | null,"signed_up_at"?: string | null,"signup_clicked_at"?: string | null,"status"?: string,"subject"?: string | null,"unsubscribed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_recipients_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "outreach_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outreach_recipients_prospect_id_fkey"
      columns: ["prospect_id"]
isOneToOne: false
      referencedRelation: "outreach_prospects"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_settings": {
                  Row: {
                    "daily_send_cap": number,"discovery_enabled": boolean,"dry_run": boolean,"enrichment_daily_limit": number,"enrichment_enabled": boolean,"id": boolean,"include_individual_entrepreneurs": boolean,"intro_template": string,"lookback_days": number,"max_contacts_per_30_days": number,"max_opportunities_per_email": number,"max_prospects_per_opportunity": number,"min_days_before_deadline": number,"min_days_between_contacts": number,"min_score": number,"reply_to": string | null,"require_validation": boolean,"sender_name": string,"subject_template": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "daily_send_cap"?: number,"discovery_enabled"?: boolean,"dry_run"?: boolean,"enrichment_daily_limit"?: number,"enrichment_enabled"?: boolean,"id"?: boolean,"include_individual_entrepreneurs"?: boolean,"intro_template"?: string,"lookback_days"?: number,"max_contacts_per_30_days"?: number,"max_opportunities_per_email"?: number,"max_prospects_per_opportunity"?: number,"min_days_before_deadline"?: number,"min_days_between_contacts"?: number,"min_score"?: number,"reply_to"?: string | null,"require_validation"?: boolean,"sender_name"?: string,"subject_template"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "daily_send_cap"?: number,"discovery_enabled"?: boolean,"dry_run"?: boolean,"enrichment_daily_limit"?: number,"enrichment_enabled"?: boolean,"id"?: boolean,"include_individual_entrepreneurs"?: boolean,"intro_template"?: string,"lookback_days"?: number,"max_contacts_per_30_days"?: number,"max_opportunities_per_email"?: number,"max_prospects_per_opportunity"?: number,"min_days_before_deadline"?: number,"min_days_between_contacts"?: number,"min_score"?: number,"reply_to"?: string | null,"require_validation"?: boolean,"sender_name"?: string,"subject_template"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"outreach_suppressions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"kind": string,"note": string | null,"reason": string,"value": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind": string,"note"?: string | null,"reason"?: string,"value": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"note"?: string | null,"reason"?: string,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outreach_suppressions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"page_views": {
                  Row: {
                    "created_at": string,"device": string,"duration_ms": number,"id": number,"path": string,"referrer_host": string | null,"session_id": string
                  }
                  Insert: {
                    "created_at"?: string,"device"?: string,"duration_ms"?: number,"id"?: never,"path": string,"referrer_host"?: string | null,"session_id": string
                  }
                  Update: {
                    "created_at"?: string,"device"?: string,"duration_ms"?: number,"id"?: never,"path"?: string,"referrer_host"?: string | null,"session_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pipeline_items": {
                  Row: {
                    "company_id": string,"created_at": string,"estimated_value": number | null,"id": string,"next_action": string | null,"next_action_at": string | null,"notes": string | null,"opportunity_id": string,"stage": Database["public"]['Enums']["pipeline_stage"],"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "company_id": string,"created_at"?: string,"estimated_value"?: number | null,"id"?: string,"next_action"?: string | null,"next_action_at"?: string | null,"notes"?: string | null,"opportunity_id": string,"stage"?: Database["public"]['Enums']["pipeline_stage"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"estimated_value"?: number | null,"id"?: string,"next_action"?: string | null,"next_action_at"?: string | null,"notes"?: string | null,"opportunity_id"?: string,"stage"?: Database["public"]['Enums']["pipeline_stage"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_items_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pipeline_items_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pipeline_items_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "department_code": string,"department_name": string,"id": number,"insee_code": string | null,"lat": number,"lng": number,"name": string,"population": number | null,"postal_code": string,"region": string,"slug": string
                  }
                  Insert: {
                    "department_code": string,"department_name": string,"id"?: number,"insee_code"?: string | null,"lat": number,"lng": number,"name": string,"population"?: number | null,"postal_code": string,"region": string,"slug": string
                  }
                  Update: {
                    "department_code"?: string,"department_name"?: string,"id"?: number,"insee_code"?: string | null,"lat"?: number,"lng"?: number,"name"?: string,"population"?: number | null,"postal_code"?: string,"region"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plans": {
                  Row: {
                    "code": string,"description": string | null,"features": NonNullable<Json>,"is_paid": boolean,"label": string,"monthly_price_cents": number | null,"sort_order": number
                  }
                  Insert: {
                    "code": string,"description"?: string | null,"features"?: NonNullable<Json>,"is_paid"?: boolean,"label": string,"monthly_price_cents"?: number | null,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"features"?: NonNullable<Json>,"is_paid"?: boolean,"label"?: string,"monthly_price_cents"?: number | null,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"proposal_documents": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"mime_type": string,"proposal_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"mime_type": string,"proposal_id": string,"size_bytes": number,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"proposal_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposal_documents_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"proposal_evaluations": {
                  Row: {
                    "buyer_company_id": string,"note": string | null,"proposal_id": string,"score": number | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "buyer_company_id": string,"note"?: string | null,"proposal_id": string,"score"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "buyer_company_id"?: string,"note"?: string | null,"proposal_id"?: string,"score"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposal_evaluations_buyer_company_id_fkey"
      columns: ["buyer_company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_evaluations_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: true
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_evaluations_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"proposals": {
                  Row: {
                    "additional_info": string | null,"buyer_note": string | null,"company_id": string,"id": string,"lead_time": string | null,"message": string,"opportunity_id": string,"price_amount": number | null,"price_currency": string,"price_details": string | null,"proposal_text": string | null,"status": Database["public"]['Enums']["proposal_status"],"submitted_at": string,"submitted_by": string | null,"updated_at": string,"valid_until": string | null
                  }
                  Insert: {
                    "additional_info"?: string | null,"buyer_note"?: string | null,"company_id": string,"id"?: string,"lead_time"?: string | null,"message": string,"opportunity_id": string,"price_amount"?: number | null,"price_currency"?: string,"price_details"?: string | null,"proposal_text"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"submitted_at"?: string,"submitted_by"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "additional_info"?: string | null,"buyer_note"?: string | null,"company_id"?: string,"id"?: string,"lead_time"?: string | null,"message"?: string,"opportunity_id"?: string,"price_amount"?: number | null,"price_currency"?: string,"price_details"?: string | null,"proposal_text"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"submitted_at"?: string,"submitted_by"?: string | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposals_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": string,"reporter_user_id": string | null,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reporter_user_id"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_user_id"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_user_id_fkey"
      columns: ["reporter_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_searches": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"query": NonNullable<Json>,"scope": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"query"?: NonNullable<Json>,"scope"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"query"?: NonNullable<Json>,"scope"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_searches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"sectors": {
                  Row: {
                    "description": string | null,"is_active": boolean,"is_pilot_priority": boolean,"label": string,"slug": string,"sort_order": number
                  }
                  Insert: {
                    "description"?: string | null,"is_active"?: boolean,"is_pilot_priority"?: boolean,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "description"?: string | null,"is_active"?: boolean,"is_pilot_priority"?: boolean,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"source_sync_runs": {
                  Row: {
                    "created": number,"duplicates": number,"errors": NonNullable<Json>,"expired": number,"fetched": number,"finished_at": string | null,"id": string,"sample": Json | null,"skipped": number,"source_id": string,"started_at": string,"status": string,"trigger": string,"triggered_by": string | null,"unchanged": number,"updated": number
                  }
                  Insert: {
                    "created"?: number,"duplicates"?: number,"errors"?: NonNullable<Json>,"expired"?: number,"fetched"?: number,"finished_at"?: string | null,"id"?: string,"sample"?: Json | null,"skipped"?: number,"source_id": string,"started_at"?: string,"status"?: string,"trigger"?: string,"triggered_by"?: string | null,"unchanged"?: number,"updated"?: number
                  }
                  Update: {
                    "created"?: number,"duplicates"?: number,"errors"?: NonNullable<Json>,"expired"?: number,"fetched"?: number,"finished_at"?: string | null,"id"?: string,"sample"?: Json | null,"skipped"?: number,"source_id"?: string,"started_at"?: string,"status"?: string,"trigger"?: string,"triggered_by"?: string | null,"unchanged"?: number,"updated"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_sync_runs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "external_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_sync_runs_triggered_by_fkey"
      columns: ["triggered_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "billing_interval": string | null,"cancel_at_period_end": boolean,"canceled_at": string | null,"company_id": string,"created_at": string,"currency": string | null,"current_period_end": string | null,"current_period_start": string | null,"ended_at": string | null,"id": string,"latest_invoice_id": string | null,"plan_code": string,"started_at": string | null,"status": string,"stripe_customer_id": string,"stripe_price_id": string | null,"stripe_subscription_id": string,"unit_amount_cents": number | null,"updated_at": string
                  }
                  Insert: {
                    "billing_interval"?: string | null,"cancel_at_period_end"?: boolean,"canceled_at"?: string | null,"company_id": string,"created_at"?: string,"currency"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"ended_at"?: string | null,"id"?: string,"latest_invoice_id"?: string | null,"plan_code": string,"started_at"?: string | null,"status": string,"stripe_customer_id": string,"stripe_price_id"?: string | null,"stripe_subscription_id": string,"unit_amount_cents"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "billing_interval"?: string | null,"cancel_at_period_end"?: boolean,"canceled_at"?: string | null,"company_id"?: string,"created_at"?: string,"currency"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"ended_at"?: string | null,"id"?: string,"latest_invoice_id"?: string | null,"plan_code"?: string,"started_at"?: string | null,"status"?: string,"stripe_customer_id"?: string,"stripe_price_id"?: string | null,"stripe_subscription_id"?: string,"unit_amount_cents"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"is_demo": boolean,"job_title": string | null,"last_seen_at": string | null,"marketing_consent": boolean,"notify_email": boolean,"phone": string | null,"platform_role": Database["public"]['Enums']["platform_role"],"status": Database["public"]['Enums']["account_status"],"terms_accepted_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string,"is_demo"?: boolean,"job_title"?: string | null,"last_seen_at"?: string | null,"marketing_consent"?: boolean,"notify_email"?: boolean,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"status"?: Database["public"]['Enums']["account_status"],"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_demo"?: boolean,"job_title"?: string | null,"last_seen_at"?: string | null,"marketing_consent"?: boolean,"notify_email"?: boolean,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"status"?: Database["public"]['Enums']["account_status"],"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_pending_invitations":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"admin_audience_detail":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"admin_audience_stats":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"admin_billing_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_create_external_opportunity":
{ Args: { "p_city": string,"p_department_code": string,"p_description": string,"p_external_buyer_name": string,"p_external_id": string,"p_is_demo"?: boolean,"p_original_url": string,"p_response_deadline": string,"p_sector_slug": string,"p_source_id": string,"p_source_published_at": string,"p_summary": string,"p_title": string,"p_type": Database["public"]['Enums']["opportunity_type"] }; Returns: string
                           },
"admin_get_reported_message":
{ Args: { "p_report_id": string }; Returns: {
              "body": string,"created_at": string,"id": string,"sender_company": string
            }[]
                           },
"admin_opportunity_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_proposals_overview":
{ Args: { "p_limit"?: number,"p_status"?: Database["public"]['Enums']["proposal_status"] }; Returns: {
              "buyer_name": string,"documents": number,"id": string,"is_demo": boolean,"opportunity_id": string,"opportunity_status": Database["public"]['Enums']["opportunity_status"],"opportunity_title": string,"status": Database["public"]['Enums']["proposal_status"],"submitted_at": string,"supplier_name": string,"supplier_slug": string,"updated_at": string
            }[]
                           },
"admin_set_company_status":
{ Args: { "p_company_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["company_status"] }; Returns: undefined
                           },
"admin_set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["platform_role"],"p_user_id": string }; Returns: undefined
                           },
"admin_set_user_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"admin_source_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "expired": number,"published": number,"source_id": string,"total": number
            }[]
                           },
"admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_update_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"admin_update_source_settings":
{ Args: { "p_config": Json,"p_id": string,"p_is_active": boolean,"p_sync_frequency": string }; Returns: undefined
                           },
"admin_upsert_external_source":
{ Args: { "p_base_url": string,"p_description": string,"p_id": string,"p_import_method": string,"p_legal_validation_confirmed"?: boolean,"p_license": string,"p_name": string,"p_notes": string,"p_status": Database["public"]['Enums']["source_status"],"p_terms_url": string }; Returns: string
                           },
"admin_verify_company":
{ Args: { "p_company_id": string,"p_note": string,"p_verified": boolean }; Returns: undefined
                           },
"admin_verify_external_opportunity":
{ Args: { "p_opportunity_id": string,"p_verification_status": string }; Returns: undefined
                           },
"advance_pipeline":
{ Args: { "p_company_id": string,"p_opportunity_id": string,"p_stage": Database["public"]['Enums']["pipeline_stage"] }; Returns: undefined
                           },
"alert_digest_matches":
{ Args: { "p_alert_id": string,"p_since": string }; Returns: {
              "id": string,"published_at": string,"title": string
            }[]
                           },
"assert_open_internal_opportunity":
{ Args: { "p_company_id": string,"p_opportunity_id": string }; Returns: {
              "budget_max": number | null,
"budget_min": number | null,
"budget_visible": boolean,
"city": string | null,
"closed_at": string | null,
"company_id": string | null,
"constraints": string | null,
"contact_name": string | null,
"cpv_codes": (string)[],
"created_at": string,
"created_by": string | null,
"criteria": string | null,
"dedup_key": string | null,
"department_code": string | null,
"description": string,
"duplicate_of": string | null,
"external_buyer_name": string | null,
"external_reference": string | null,
"id": string,
"is_demo": boolean,
"keywords": (string)[],
"lat": number | null,
"lng": number | null,
"max_suppliers": number | null,
"moderation_note": string | null,
"origin": Database["public"]['Enums']["opportunity_origin"],
"outcome": Database["public"]['Enums']["opportunity_outcome"] | null,
"outcome_note": string | null,
"postal_code": string | null,
"published_at": string | null,
"publisher_attested_at": string | null,
"region": string | null,
"response_deadline": string | null,
"search_vector": unknown,
"sector_slug": string | null,
"selected_proposal_id": string | null,
"services": string | null,
"skills": (string)[],
"start_date": string | null,
"status": Database["public"]['Enums']["opportunity_status"],
"summary": string | null,
"target_company_size": Database["public"]['Enums']["company_size"] | null,
"title": string,
"type": Database["public"]['Enums']["opportunity_type"],
"updated_at": string,
"visibility": Database["public"]['Enums']["opportunity_visibility"]
            }
                          SetofOptions: {
        from: "*"
        to: "opportunities"
        isOneToOne: true
        isSetofReturn: false
      } },
"audience_window":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"bootstrap_super_admin":
{ Args: { "p_email": string }; Returns: boolean
                           },
"buyer_set_interest_status":
{ Args: { "p_interest_id": string,"p_message"?: string,"p_status": Database["public"]['Enums']["interest_status"] }; Returns: undefined
                           },
"buyer_set_proposal_status":
{ Args: { "p_message"?: string,"p_proposal_id": string,"p_status": Database["public"]['Enums']["proposal_status"] }; Returns: undefined
                           },
"can_view_opportunity":
{ Args: { "p_opportunity_id": string }; Returns: boolean
                           },
"can_view_proposal":
{ Args: { "p_proposal_id": string }; Returns: boolean
                           },
"close_opportunity":
{ Args: { "p_note"?: string,"p_opportunity_id": string,"p_outcome": Database["public"]['Enums']["opportunity_outcome"],"p_selected_proposal_id"?: string }; Returns: undefined
                           },
"company_has_feature":
{ Args: { "p_company_id": string,"p_key": string }; Returns: boolean
                           },
"company_plan":
{ Args: { "p_company_id": string }; Returns: string
                           },
"company_usage":
{ Args: { "p_company_id": string }; Returns: Json
                           },
"create_company":
{ Args: { "p_city"?: string,"p_description"?: string,"p_kind": Database["public"]['Enums']["company_kind"],"p_name": string,"p_postal_code"?: string,"p_sectors"?: (string)[],"p_siren"?: string,"p_size"?: Database["public"]['Enums']["company_size"],"p_skills"?: (string)[],"p_tagline"?: string,"p_website"?: string }; Returns: string
                           },
"create_report":
{ Args: { "p_details": string,"p_reason": string,"p_target_id": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: string
                           },
"dispatch_immediate_alerts":
{ Args: { "p_opportunity_id": string }; Returns: number
                           },
"distance_km":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"enforce_rate_limit":
{ Args: { "p_max": number,"p_scope": string,"p_window_seconds": number }; Returns: undefined
                           },
"expire_opportunities":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"express_interest":
{ Args: { "p_company_id": string,"p_message"?: string,"p_opportunity_id": string }; Returns: string
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"in_trusted_context":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"invite_company_member":
{ Args: { "p_company_id": string,"p_email": string,"p_role": Database["public"]['Enums']["company_role"] }; Returns: string
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_company_active":
{ Args: { "p_company_id": string }; Returns: boolean
                           },
"is_company_admin":
{ Args: { "p_company_id": string }; Returns: boolean
                           },
"is_company_member":
{ Args: { "p_company_id": string }; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"is_opportunity_owner":
{ Args: { "p_opportunity_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_audit":
{ Args: { "p_action": string,"p_entity_id": string,"p_entity_type": string,"p_metadata"?: Json }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_opportunity_duplicate":
{ Args: { "p_duplicate_of": string,"p_opportunity_id": string }; Returns: undefined
                           },
"moderate_opportunity":
{ Args: { "p_action": Database["public"]['Enums']["moderation_action_type"],"p_opportunity_id": string,"p_reason"?: string }; Returns: undefined
                           },
"my_company_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"notify_company":
{ Args: { "p_body": string,"p_company_id": string,"p_exclude_user"?: string,"p_link": string,"p_send_email"?: boolean,"p_title": string,"p_type": string }; Returns: undefined
                           },
"notify_staff":
{ Args: { "p_body": string,"p_link": string,"p_title": string,"p_type": string }; Returns: undefined
                           },
"notify_user":
{ Args: { "p_body": string,"p_link": string,"p_send_email"?: boolean,"p_title": string,"p_type": string,"p_user_id": string }; Returns: undefined
                           },
"open_opportunity_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "dimension": string,"key": string,"n": number
            }[]
                           },
"opportunity_matches_alert":
{ Args: { "p_alert_id": string,"p_opportunity_id": string }; Returns: boolean
                           },
"opportunity_owner_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["opportunity_status"],"p_to": Database["public"]['Enums']["opportunity_status"] }; Returns: boolean
                           },
"outreach_campaign_stats":
{ Args: { "p_campaign_id": string }; Returns: Json
                           },
"pipeline_rank":
{ Args: { "p_stage": Database["public"]['Enums']["pipeline_stage"] }; Returns: number
                           },
"plan_feature":
{ Args: { "p_key": string,"p_plan": string }; Returns: Json
                           },
"prepare_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"public_platform_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"purge_page_views":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"raise_plan_limit":
{ Args: { "p_key": string,"p_message": string }; Returns: undefined
                           },
"recommended_opportunities":
{ Args: { "p_company_id": string,"p_include_demo"?: boolean,"p_limit"?: number }; Returns: {
              "city": string,"id": string,"is_demo": boolean,"origin": Database["public"]['Enums']["opportunity_origin"],"published_at": string,"reasons": (string)[],"response_deadline": string,"score": number,"sector_slug": string,"title": string,"type": Database["public"]['Enums']["opportunity_type"]
            }[]
                           },
"register_proposal_document":
{ Args: { "p_file_name": string,"p_mime_type": string,"p_proposal_id": string,"p_size_bytes": number,"p_storage_path": string }; Returns: string
                           },
"remove_company_member":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"require_active_user":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"require_admin":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"require_staff":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reserved_company_slugs":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"resolve_place":
{ Args: { "p_city": string,"p_postal_code": string }; Returns: {
              "department_code": string,
"department_name": string,
"id": number,
"insee_code": string | null,
"lat": number,
"lng": number,
"name": string,
"population": number | null,
"postal_code": string,
"region": string,
"slug": string
            }
                          SetofOptions: {
        from: "*"
        to: "places"
        isOneToOne: true
        isSetofReturn: false
      } },
"resolve_report":
{ Args: { "p_note": string,"p_report_id": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"save_proposal_evaluation":
{ Args: { "p_note": string,"p_proposal_id": string,"p_score": number }; Returns: undefined
                           },
"search_companies":
{ Args: { "p_department"?: string,"p_include_demo"?: boolean,"p_kind"?: Database["public"]['Enums']["company_kind"],"p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_sector"?: string,"p_size"?: Database["public"]['Enums']["company_size"],"p_skills"?: (string)[] }; Returns: {
              "city": string,"department_code": string,"id": string,"is_demo": boolean,"kind": Database["public"]['Enums']["company_kind"],"logo_path": string,"name": string,"sectors": (string)[],"size": Database["public"]['Enums']["company_size"],"skills": (string)[],"slug": string,"tagline": string,"total_count": number,"verified": boolean
            }[]
                           },
"search_opportunities":
{ Args: { "p_city"?: string,"p_company_size"?: Database["public"]['Enums']["company_size"],"p_deadline_before"?: string,"p_department"?: string,"p_include_demo"?: boolean,"p_limit"?: number,"p_offset"?: number,"p_origin"?: Database["public"]['Enums']["opportunity_origin"],"p_place"?: string,"p_published_since"?: string,"p_q"?: string,"p_radius_km"?: number,"p_region"?: string,"p_sector"?: string,"p_skills"?: (string)[],"p_sort"?: string,"p_source"?: string,"p_status"?: string,"p_types"?: (Database["public"]['Enums']["opportunity_type"])[] }; Returns: {
              "budget_max": number,"budget_min": number,"budget_visible": boolean,"city": string,"company_id": string,"company_name": string,"company_slug": string,"company_verified": boolean,"department_code": string,"distance_km": number,"effective_status": string,"external_buyer_name": string,"id": string,"is_demo": boolean,"origin": Database["public"]['Enums']["opportunity_origin"],"published_at": string,"rank": number,"region": string,"response_deadline": string,"sector_slug": string,"skills": (string)[],"source_name": string,"status": Database["public"]['Enums']["opportunity_status"],"summary": string,"title": string,"total_count": number,"type": Database["public"]['Enums']["opportunity_type"],"visibility": Database["public"]['Enums']["opportunity_visibility"]
            }[]
                           },
"send_message":
{ Args: { "p_attachment_name"?: string,"p_attachment_path"?: string,"p_body": string,"p_conversation_id": string }; Returns: string
                           },
"set_company_member_role":
{ Args: { "p_member_id": string,"p_role": Database["public"]['Enums']["company_role"] }; Returns: undefined
                           },
"slugify":
{ Args: { "p_text": string }; Returns: string
                           },
"start_conversation":
{ Args: { "p_body": string,"p_opportunity_id": string,"p_supplier_company_id": string }; Returns: string
                           },
"storage_parent_id":
{ Args: { "p_name": string }; Returns: string
                           },
"submit_proposal":
{ Args: { "p_additional_info"?: string,"p_company_id": string,"p_lead_time"?: string,"p_message": string,"p_opportunity_id": string,"p_price_amount"?: number,"p_price_details"?: string,"p_proposal_text"?: string,"p_valid_until"?: string }; Returns: string
                           },
"track_event":
{ Args: { "p_event_name": string,"p_properties"?: Json }; Returns: undefined
                           },
"trusted":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"unaccent_simple":
{ Args: { "p": string }; Returns: string
                           },
"unique_company_slug":
{ Args: { "p_name": string }; Returns: string
                           },
"user_plan":
{ Args: { "p_user_id"?: string }; Returns: string
                           },
"withdraw_interest":
{ Args: { "p_interest_id": string }; Returns: undefined
                           },
"withdraw_proposal":
{ Args: { "p_proposal_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "ACTIVE"|"SUSPENDED"|"DELETED","alert_frequency": "IMMEDIATE"|"DAILY"|"WEEKLY","company_kind": "SUPPLIER"|"BUYER"|"BOTH","company_role": "COMPANY_MEMBER"|"COMPANY_ADMIN","company_size": "INDEPENDANT"|"TPE"|"PME"|"ETI"|"GE","company_status": "PENDING"|"ACTIVE"|"SUSPENDED","email_status": "PENDING"|"SENT"|"FAILED"|"SKIPPED","interest_status": "PENDING"|"SHORTLISTED"|"INFO_REQUESTED"|"ACCEPTED"|"DECLINED"|"WITHDRAWN","moderation_action_type": "APPROVE"|"REJECT"|"REQUEST_CHANGES"|"SUSPEND"|"ARCHIVE"|"REINSTATE","opportunity_origin": "INTERNAL"|"EXTERNAL","opportunity_outcome": "AWARDED"|"NOT_AWARDED"|"CANCELLED"|"UNKNOWN","opportunity_status": "DRAFT"|"PENDING_REVIEW"|"CHANGES_REQUESTED"|"REJECTED"|"PUBLISHED"|"CLOSED"|"EXPIRED"|"SUSPENDED"|"ARCHIVED","opportunity_type": "NEED"|"QUOTE_REQUEST"|"PRIVATE_CONSULTATION"|"PRIVATE_TENDER"|"EXTERNAL_OPPORTUNITY"|"PUBLIC_TENDER","opportunity_visibility": "PUBLIC"|"MEMBERS_ONLY","pipeline_stage": "DETECTED"|"QUALIFIED"|"INTERESTED"|"RESPONSE_PREPARING"|"RESPONSE_SENT"|"DISCUSSION"|"NEGOTIATION"|"WON"|"LOST","platform_role": "USER"|"MODERATOR"|"ADMIN"|"SUPER_ADMIN","proposal_status": "SUBMITTED"|"SHORTLISTED"|"INFO_REQUESTED"|"SELECTED"|"DECLINED"|"WITHDRAWN","report_status": "OPEN"|"REVIEWING"|"RESOLVED"|"DISMISSED","report_target": "OPPORTUNITY"|"COMPANY"|"MESSAGE"|"USER"|"PROPOSAL","source_status": "DRAFT"|"LEGAL_REVIEW"|"APPROVED"|"SUSPENDED"|"REJECTED"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["ACTIVE", "SUSPENDED", "DELETED"],"alert_frequency": ["IMMEDIATE", "DAILY", "WEEKLY"],"company_kind": ["SUPPLIER", "BUYER", "BOTH"],"company_role": ["COMPANY_MEMBER", "COMPANY_ADMIN"],"company_size": ["INDEPENDANT", "TPE", "PME", "ETI", "GE"],"company_status": ["PENDING", "ACTIVE", "SUSPENDED"],"email_status": ["PENDING", "SENT", "FAILED", "SKIPPED"],"interest_status": ["PENDING", "SHORTLISTED", "INFO_REQUESTED", "ACCEPTED", "DECLINED", "WITHDRAWN"],"moderation_action_type": ["APPROVE", "REJECT", "REQUEST_CHANGES", "SUSPEND", "ARCHIVE", "REINSTATE"],"opportunity_origin": ["INTERNAL", "EXTERNAL"],"opportunity_outcome": ["AWARDED", "NOT_AWARDED", "CANCELLED", "UNKNOWN"],"opportunity_status": ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "CLOSED", "EXPIRED", "SUSPENDED", "ARCHIVED"],"opportunity_type": ["NEED", "QUOTE_REQUEST", "PRIVATE_CONSULTATION", "PRIVATE_TENDER", "EXTERNAL_OPPORTUNITY", "PUBLIC_TENDER"],"opportunity_visibility": ["PUBLIC", "MEMBERS_ONLY"],"pipeline_stage": ["DETECTED", "QUALIFIED", "INTERESTED", "RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"],"platform_role": ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"],"proposal_status": ["SUBMITTED", "SHORTLISTED", "INFO_REQUESTED", "SELECTED", "DECLINED", "WITHDRAWN"],"report_status": ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"],"report_target": ["OPPORTUNITY", "COMPANY", "MESSAGE", "USER", "PROPOSAL"],"source_status": ["DRAFT", "LEGAL_REVIEW", "APPROVED", "SUSPENDED", "REJECTED"]
          }
        }
} as const
