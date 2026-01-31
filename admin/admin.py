#!/usr/bin/env python3
"""
SAL Northside Fund Manager - Admin Tool
Manage members, payments, and fund settings via REST API
"""

import requests
import json
from typing import Optional, Dict, List
from datetime import datetime

class SALFundAdmin:
    def __init__(self, api_url: str = "http://localhost:3000/api"):
        self.api_url = api_url
        self.session = requests.Session()
        
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make API request"""
        url = f"{self.api_url}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url)
            elif method == "POST":
                response = self.session.post(url, json=data)
            elif method == "PUT":
                response = self.session.put(url, json=data)
            elif method == "DELETE":
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            return None
    
    # ==================== MEMBER MANAGEMENT ====================
    
    def list_members(self) -> Dict:
        """Get all members grouped by rank"""
        print("\n📋 Fetching all members...")
        members = self._request("GET", "/members")
        
        if members:
            print("\n" + "="*60)
            print("MEMBERS LIST")
            print("="*60)
            
            for rank in ['ALAS', 'POINTMAN', 'JUNIOR', 'MINORS']:
                if rank in members and members[rank]:
                    print(f"\n{rank} ({len(members[rank])} members):")
                    print("-" * 60)
                    for member in members[rank]:
                        print(f"  ID: {member['id']:3d} | {member['name']}")
            
            total = sum(len(members[rank]) for rank in members)
            print(f"\n{'='*60}")
            print(f"Total Members: {total}")
            print("="*60)
        
        return members
    
    def add_member(self, name: str, rank: str) -> Dict:
        """Add a new member"""
        valid_ranks = ['ALAS', 'POINTMAN', 'JUNIOR', 'MINORS']
        rank = rank.upper()
        
        if rank not in valid_ranks:
            print(f"❌ Invalid rank. Must be one of: {', '.join(valid_ranks)}")
            return None
        
        data = {
            "name": name.upper(),
            "rank": rank
        }
        
        result = self._request("POST", "/members", data)
        
        if result:
            print(f"✅ Member added: {name} ({rank}) - ID: {result.get('id')}")
        
        return result
    
    def update_member(self, member_id: int, name: Optional[str] = None, 
                     rank: Optional[str] = None, active: Optional[bool] = None) -> Dict:
        """Update member details"""
        data = {}
        
        if name:
            data['name'] = name.upper()
        if rank:
            data['rank'] = rank.upper()
        if active is not None:
            data['active'] = active
        
        if not data:
            print("❌ No updates provided")
            return None
        
        result = self._request("PUT", f"/members/{member_id}", data)
        
        if result:
            print(f"✅ Member {member_id} updated successfully")
        
        return result
    
    def remove_member(self, member_id: int) -> Dict:
        """Deactivate a member"""
        result = self._request("DELETE", f"/members/{member_id}")
        
        if result:
            print(f"✅ Member {member_id} deactivated")
        
        return result
    
    # ==================== PAYMENT MANAGEMENT ====================
    
    def view_month_payments(self, year: int, month: int) -> List:
        """View all payments for a specific month"""
        print(f"\n📅 Fetching payments for {month}/{year}...")
        payments = self._request("GET", f"/payments/{year}/{month}")
        
        if payments:
            print("\n" + "="*80)
            print(f"PAYMENTS FOR {month}/{year}")
            print("="*80)
            
            for payment in payments:
                ns_status = "✅ PAID" if payment.get('northside_paid') else "❌ UNPAID"
                la_status = "✅ PAID" if payment.get('la_paid') else "❌ UNPAID"
                
                print(f"\n{payment['name']} ({payment['rank']})")
                print(f"  Northside: ₱{payment.get('northside_amount', 0):.2f} - {ns_status}")
                print(f"  L.A Fund:  ₱{payment.get('la_amount', 0):.2f} - {la_status}")
            
            print("="*80)
        
        return payments
    
    def mark_payment(self, payment_id: int, fund_type: str, paid: bool) -> Dict:
        """Mark a payment as paid or unpaid"""
        fund_type = fund_type.lower()
        
        if fund_type not in ['northside', 'la']:
            print("❌ Invalid fund type. Must be 'northside' or 'la'")
            return None
        
        data = {
            f"{fund_type}_paid": paid
        }
        
        result = self._request("PUT", f"/payments/{payment_id}", data)
        
        if result:
            status = "PAID" if paid else "UNPAID"
            print(f"✅ Payment {payment_id} marked as {status} for {fund_type.upper()} fund")
        
        return result
    
    def update_payment_amount(self, payment_id: int, northside: Optional[float] = None, 
                             la: Optional[float] = None) -> Dict:
        """Update payment amounts"""
        data = {}
        
        if northside is not None:
            data['northside_amount'] = northside
        if la is not None:
            data['la_amount'] = la
        
        if not data:
            print("❌ No amounts provided")
            return None
        
        result = self._request("PUT", f"/payments/{payment_id}", data)
        
        if result:
            print(f"✅ Payment {payment_id} amounts updated")
        
        return result
    
    def initialize_month(self, year: int, month: int) -> Dict:
        """Initialize payments for a new month"""
        data = {
            "year": year,
            "month": month
        }
        
        result = self._request("POST", "/payments/initialize", data)
        
        if result:
            print(f"✅ Initialized payments for {month}/{year}")
            print(f"   Created {result.get('count', 0)} payment records")
        
        return result
    
    # ==================== FUND SETTINGS ====================
    
    def view_settings(self) -> List:
        """View fund settings for all ranks"""
        print("\n⚙️  Fetching fund settings...")
        settings = self._request("GET", "/settings")
        
        if settings:
            print("\n" + "="*60)
            print("FUND SETTINGS")
            print("="*60)
            
            for setting in settings:
                print(f"\n{setting['rank']}:")
                print(f"  Northside Default: ₱{setting['northside_default']:.2f}")
                print(f"  L.A Default:       ₱{setting['la_default']:.2f}")
            
            print("="*60)
        
        return settings
    
    def update_settings(self, rank: str, northside: float, la: float) -> Dict:
        """Update default fund amounts for a rank"""
        rank = rank.upper()
        
        data = {
            "northside_default": northside,
            "la_default": la
        }
        
        result = self._request("PUT", f"/settings/{rank}", data)
        
        if result:
            print(f"✅ Settings updated for {rank}")
            print(f"   Northside: ₱{northside:.2f}")
            print(f"   L.A Fund:  ₱{la:.2f}")
        
        return result
    
    # ==================== STATISTICS ====================
    
    def view_stats(self) -> Dict:
        """View overall statistics"""
        print("\n📊 Fetching statistics...")
        stats = self._request("GET", "/stats")
        
        if stats:
            print("\n" + "="*60)
            print("STATISTICS")
            print("="*60)
            
            print("\nMembers by Rank:")
            for rank in stats.get('membersByRank', []):
                print(f"  {rank['rank']}: {rank['count']} members")
            
            year_totals = stats.get('yearTotals', {})
            current_year = datetime.now().year
            
            print(f"\n{current_year} Collections:")
            print(f"  Northside Fund: ₱{year_totals.get('northside_year_total', 0):.2f}")
            print(f"  L.A Fund:       ₱{year_totals.get('la_year_total', 0):.2f}")
            
            print("="*60)
        
        return stats


def main_menu():
    """Interactive menu"""
    admin = SALFundAdmin()
    
    while True:
        print("\n" + "="*60)
        print("SAL NORTHSIDE FUND MANAGER - ADMIN TOOL")
        print("="*60)
        print("\n📋 MEMBER MANAGEMENT")
        print("  1. List all members")
        print("  2. Add new member")
        print("  3. Update member")
        print("  4. Remove member")
        print("\n💰 PAYMENT MANAGEMENT")
        print("  5. View month payments")
        print("  6. Initialize new month")
        print("  7. Mark payment as paid/unpaid")
        print("  8. Update payment amount")
        print("\n⚙️  SETTINGS")
        print("  9. View fund settings")
        print("  10. Update fund settings")
        print("\n📊 STATISTICS")
        print("  11. View statistics")
        print("\n  0. Exit")
        print("="*60)
        
        choice = input("\nSelect option: ").strip()
        
        try:
            if choice == "0":
                print("\n👋 Goodbye!")
                break
            elif choice == "1":
                admin.list_members()
            elif choice == "2":
                name = input("Enter member name: ").strip()
                rank = input("Enter rank (ALAS/POINTMAN/JUNIOR/MINORS): ").strip()
                admin.add_member(name, rank)
            elif choice == "3":
                member_id = int(input("Enter member ID: "))
                name = input("New name (press Enter to skip): ").strip() or None
                rank = input("New rank (press Enter to skip): ").strip() or None
                admin.update_member(member_id, name, rank)
            elif choice == "4":
                member_id = int(input("Enter member ID: "))
                confirm = input(f"Deactivate member {member_id}? (yes/no): ")
                if confirm.lower() == 'yes':
                    admin.remove_member(member_id)
            elif choice == "5":
                year = int(input("Enter year: "))
                month = int(input("Enter month (1-12): "))
                admin.view_month_payments(year, month)
            elif choice == "6":
                year = int(input("Enter year: "))
                month = int(input("Enter month (1-12): "))
                admin.initialize_month(year, month)
            elif choice == "7":
                payment_id = int(input("Enter payment ID: "))
                fund_type = input("Fund type (northside/la): ").strip()
                paid = input("Mark as paid? (yes/no): ").lower() == 'yes'
                admin.mark_payment(payment_id, fund_type, paid)
            elif choice == "8":
                payment_id = int(input("Enter payment ID: "))
                northside = input("Northside amount (or Enter to skip): ").strip()
                la = input("L.A amount (or Enter to skip): ").strip()
                admin.update_payment_amount(
                    payment_id,
                    float(northside) if northside else None,
                    float(la) if la else None
                )
            elif choice == "9":
                admin.view_settings()
            elif choice == "10":
                rank = input("Enter rank (ALAS/POINTMAN/JUNIOR/MINORS): ").strip()
                northside = float(input("Northside default amount: "))
                la = float(input("L.A default amount: "))
                admin.update_settings(rank, northside, la)
            elif choice == "11":
                admin.view_stats()
            else:
                print("❌ Invalid option")
        
        except ValueError as e:
            print(f"❌ Invalid input: {e}")
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("\n🚀 Starting SAL Fund Manager Admin Tool...")
    print("📡 Connecting to API at http://localhost:3000/api")
    main_menu()