import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ success:false, error:"Method not allowed" }), { status:405, headers:cors });
  try {
    const { order_number, email } = await req.json();
    if (typeof order_number !== "string" || typeof email !== "string" || !order_number.trim() || !email.trim()) return new Response(JSON.stringify({ success:false,error:"Order number and email are required." }), {status:400,headers:cors});
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url,key,{auth:{persistSession:false}});
    const { data: order, error } = await db.from("orders").select("id,order_number,customer_email,total_amount,payment_method,payment_status,order_status,tracking_number,created_at").eq("order_number",order_number.trim()).ilike("customer_email",email.trim()).maybeSingle();
    if (error) throw error;
    if (!order) return new Response(JSON.stringify({success:false,error:"We couldn't find an order matching those details."}),{status:404,headers:cors});
    const { data: items, error: itemsError } = await db.from("order_items").select("product_name,quantity,unit_price,line_total").eq("order_id",order.id);
    if (itemsError) throw itemsError;
    const { customer_email: _privateEmail, id: _id, ...safeOrder } = order;
    return new Response(JSON.stringify({success:true,order:{...safeOrder,items:items||[]}}),{status:200,headers:cors});
  } catch (e) { console.error("track-order error",e); return new Response(JSON.stringify({success:false,error:"Order tracking is temporarily unavailable. Please try again later."}),{status:500,headers:cors}); }
});
